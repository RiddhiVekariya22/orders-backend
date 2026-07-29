CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending',
  gcs_path TEXT,
  processed_rows INT DEFAULT 0,
  failed_rows INT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rejected_orders (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID REFERENCES jobs(id),
  raw_row JSONB,
  reason TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rejected_orders_job_id ON rejected_orders(job_id);
