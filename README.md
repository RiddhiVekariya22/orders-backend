## Sharding Strategy
Reason for choosing to shard on order date : For an analytics platform, most users would be seeing dashboards and charts showing trends over a date range of their orders, For the specific use case of speed ecom solutions, I assume that users searching for orders on customer_id wouldnt be as frequent as the date based filtering. 

On the case of searches based on order id, Order ID Lookup Index: global_order_index(order_id, shard_index) table in control_db could eliminate fan-out queries for single-order lookups, this is in scope for future

## tradeoffs 

possible uneven shard growth - During some months the orders volumne might be signficantly higher than the other months, this could create uneven shard sizes, unlike other keys like order_id or customer_id.

Write hot-spotting - The current month shard would be heavily used, while other 3 shards not experiencing that much traffic, meaning we cant expect 4x concurrent write throughput. 

We accept both costs in exchange for read efficiency: as an analytics
platform, most user-facing operations are read/query heavy (dashboards,
date-range reports), so minimizing the number of shards touched per read
was prioritized over even write distribution. 

Here we have tradded the writes distribution off with the read operation efficiency(minimizing the number of shards touched per read), data uploads are turned into background jobs and focus is on providing fastest responses to the users, and reducing the number of DB reads as much as possible.

```
                    ┌─────────────────────────┐
                    │     CSV Ingestion       │
                    └────────────┬────────────┘
                                 │
                   Calculate month % 4 from order_date
                                 │
        ┌────────────────┬───────┴────────┬────────────────┐
        ▼                ▼                ▼                ▼
  ┌───────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐
  │  Shard 0  │    │  Shard 1  │    │  Shard 2  │    │  Shard 3  │
  │ (Jan, May,│    │ (Feb, Jun,│    │ (Mar, Jul,│    │ (Apr, Aug,│
  │  Sep, ...)│    │  Oct, ...)│    │  Nov, ...)│    │  Dec, ...)│
  └───────────┘    └───────────┘    └───────────┘    └───────────┘
```

### 1. Partitioning Function

The shard index is computed deterministically from the UTC month of the `order_date`:

$$\text{shardIndex} = \text{getUTCMonth}(\text{order\_date}) \pmod 4$$

- **Shard 0**: January, May, September
- **Shard 1**: February, June, October
- **Shard 2**: March, July, November
- **Shard 3**: April, August, December

### 2. Query Routing & Optimization

- **Date Range Queries (`startDate` & `endDate`)**: `getShardsForDateRange(startDate, endDate)` computes the exact subset of shards touched by the range. Queries are sent **only** to relevant shards, avoiding unnecessary database load.
- **Point Lookups (`/orders/:orderId`) & Customer Searches (`customerId` only)**: Queries fan out in parallel (`Promise.all`) across target shards and results are merged and sorted by `order_date DESC`.
- **Bulk Insert Routing**: During CSV parsing, incoming records are grouped by target shard index in memory before triggering parallel bulk SQL inserts.


---

Design Decision

Why I choose vertical Sliced architecture instead of a layered one : 
The current application focuses on a single domain, orders, so a layered
structure (separate top-level `controllers/`, `services/`, `repositories`, `db/` folders) would have been unnecessary, however if multiple domains are to be added in the future we should refactor to a layered one.

Future Scope :
 BullMQ + Redis. The current `setImmediate` trigger
demonstrates the async pattern but has real limitations at production
scale, an in-flight job is lost if the server restarts, there's no
automatic retry with backoff, and it can't be distributed across multiple
worker processes. A real queue (BullMQ, backed by Redis) would address
all three.

Due to time constraints I have kept a simpler implementation of JOBs Right now and it would have added infrastructure (a Redis dependency, a separate
worker process, connection/deployment config) disproportionate to this
project's actual scale. 

---

## Google Application Default Credentials (ADC) Configuration

The application uses the official `@google-cloud/storage` SDK to store uploaded CSV files. Authentication operates via Google Cloud **Application Default Credentials (ADC)**.

### How ADC is Resolved

The SDK automatically searches for credentials in the following order:

1. **`GOOGLE_APPLICATION_CREDENTIALS` Environment Variable**: Set this variable in your `.env` or environment to point to the absolute path of a GCP Service Account JSON key file:
   ```bash
   GOOGLE_APPLICATION_CREDENTIALS="C:\keys\gcp-service-account.json"
   ```
2. **gcloud CLI Credentials (Local Development)**: If running locally without a service account key file, authenticate via gcloud CLI:
   ```bash
   gcloud auth application-default login
   ```


### Automatic Local Fallback Mode

If `GCS_BUCKET_NAME` is omitted from `.env`, the adapter (`src/shared/gcs-adapter.js`) automatically falls back to local disk storage (`./local-gcs-fallback/`) without requiring GCP credentials or network calls.

---

## API Specification

### 1. Upload Orders CSV
`POST /upload-orders`

Uploads a CSV file for ingestion. Accepts `multipart/form-data` with `file` field.

**Response (`202 Accepted`)**:
```json
{
  "jobId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  "status": "pending"
}
```

### 2. Get Ingestion Job Status
`GET /jobs/:jobId`

**Response (`200 OK`)**:
```json
{
  "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  "status": "done",
  "gcs_path": "local://1785290390-orders.csv",
  "processed_rows": 1000,
  "failed_rows": 5,
  "error_message": null,
  "created_at": "2026-07-29T07:00:00.000Z",
  "updated_at": "2026-07-29T07:00:05.000Z"
}
```

### 3. Get Order by ID
`GET /orders/:orderId`

**Response (`200 OK`)**:
```json
{
  "order_id": "c39a04f2-901d-407b-83ff-183709b18365",
  "customer_id": "cust-101",
  "order_date": "2026-05-15T10:00:00.000Z",
  "order_amount": "150.50",
  "status": "completed",
  "created_at": "2026-07-29T07:00:02.000Z"
}
```

### 4. Search Orders
`GET /orders?customerId=cust-101&startDate=2026-01-01&endDate=2026-06-30`

- Query parameters: `customerId` (optional), `startDate` (optional), `endDate` (optional). Must supply at least `customerId` OR both `startDate` & `endDate`.

### 5. System Health Check
`GET /health`

**Response (`200 OK`)**:
```json
{
  "status": "ok",
  "databases": [
    { "name": "shard_0", "status": "ok" },
    { "name": "shard_1", "status": "ok" },
    { "name": "shard_2", "status": "ok" },
    { "name": "shard_3", "status": "ok" },
    { "name": "control_db", "status": "ok" }
  ]
}
```

---

## Setup and Run Instructions


### 1. Environment Configuration

Copy `.env.example` to `.env` in the project root:

```bash
cp .env.example .env
```

Configure database connection strings and optional GCS settings in `.env`:

```env
SHARD_0_URL=postgres://user:password@localhost:5432/shard_0
SHARD_1_URL=postgres://user:password@localhost:5432/shard_1
SHARD_2_URL=postgres://user:password@localhost:5432/shard_2
SHARD_3_URL=postgres://user:password@localhost:5432/shard_3
CONTROL_DB_URL=postgres://user:password@localhost:5432/control_db

# Optional GCS Configuration (Leave blank for local filesystem storage)
GCS_BUCKET_NAME=my-orders-bucket
GCS_PROJECT_ID=my-gcp-project-id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/keyfile.json
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Database Migrations

Apply database schemas (`schema.sql` to all 4 shards and `jobs-schema.sql` to the control database):

```bash
node src/migrate-all.js
```

### 4. Start the Application

Start the API server (default port `3000`):

```bash
npm start
```

For development mode:

```bash
node src/index.js
```

### Docker & Docker Compose Setup

To launch the complete environment (Node.js API application + 4 PostgreSQL database shards + 1 control database instance) using Docker Compose:

1. **Build and start all services**:
   ```bash
   docker-compose up --build
   ```

   This command will:
   - Spin up 5 PostgreSQL containers (`shard_0`, `shard_1`, `shard_2`, `shard_3`, `control_db`).
   - Wait for all database instances to pass health checks (`pg_isready`).
   - Build the Node.js application image using `Dockerfile`.
   - Run database migrations (`node src/migrate-all.js`) automatically on startup.
   - Start the HTTP API server listening on `http://localhost:3000`.

2. **Verify running containers**:
   ```bash
   docker-compose ps
   ```

3. **Check container logs**:
   ```bash
   docker-compose logs -f app
   ```

4. **Stop and clean up containers & volumes**:
   ```bash
   docker-compose down -v
   ```

---

## Testing

Run all unit and integration test suites using Jest:

```bash
npm test
```
