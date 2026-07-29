jest.mock('../src/shared/pool', () => ({
  controlPool: {
    query: jest.fn(),
  },
}));

jest.mock('../src/shared/db', () => ({
  withTransaction: jest.fn((pool, callback) => callback(pool)),
}));

const { controlPool } = require('../src/shared/pool');
const {
  createJob,
  updateJobProgress,
  setJobStatus,
  getJob,
  insertRejectedOrders,
} = require('../src/orders/jobs.repository');

describe('jobs.repository module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createJob', () => {
    it('inserts new job with pending status and returns generated id', async () => {
      controlPool.query.mockResolvedValueOnce({
        rows: [{ id: 'job-123' }],
      });

      const jobId = await createJob('local://sample.csv');

      expect(jobId).toBe('job-123');
      expect(controlPool.query).toHaveBeenCalledWith(
        `INSERT INTO jobs (status, gcs_path) VALUES ('pending', $1) RETURNING id`,
        ['local://sample.csv']
      );
    });
  });

  describe('updateJobProgress', () => {
    it('updates processed_rows and failed_rows counts', async () => {
      controlPool.query.mockResolvedValueOnce({});

      await updateJobProgress('job-123', { processedDelta: 100, failedDelta: 5 });

      expect(controlPool.query).toHaveBeenCalledWith(
        `UPDATE jobs SET processed_rows = processed_rows + $1, failed_rows = failed_rows + $2, updated_at = now() WHERE id = $3`,
        [100, 5, 'job-123']
      );
    });
  });

  describe('setJobStatus', () => {
    it('updates job status and error message', async () => {
      controlPool.query.mockResolvedValueOnce({});

      await setJobStatus('job-123', 'failed', 'Error detail');

      expect(controlPool.query).toHaveBeenCalledWith(
        `UPDATE jobs SET status = $1, error_message = $2, updated_at = now() WHERE id = $3`,
        ['failed', 'Error detail', 'job-123']
      );
    });
  });

  describe('getJob', () => {
    it('returns job row when found', async () => {
      const mockJob = { id: 'job-123', status: 'pending', gcs_path: 'local://sample.csv' };
      controlPool.query.mockResolvedValueOnce({ rows: [mockJob] });

      const result = await getJob('job-123');
      expect(result).toEqual(mockJob);
      expect(controlPool.query).toHaveBeenCalledWith(
        `SELECT * FROM jobs WHERE id = $1`,
        ['job-123']
      );
    });

    it('returns null when job is not found', async () => {
      controlPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await getJob('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('insertRejectedOrders', () => {
    it('does nothing if rows array is empty', async () => {
      await insertRejectedOrders('job-123', []);
      expect(controlPool.query).not.toHaveBeenCalled();
    });

    it('inserts rejected orders in transaction when rows exist', async () => {
      controlPool.query.mockResolvedValueOnce({});
      const rejectedRows = [
        { raw_row: { order_id: 'bad-1' }, reason: 'missing customer_id' },
      ];

      await insertRejectedOrders('job-123', rejectedRows);

      expect(controlPool.query).toHaveBeenCalledWith(
        `INSERT INTO rejected_orders (job_id, raw_row, reason) VALUES ($1, $2, $3)`,
        ['job-123', JSON.stringify({ order_id: 'bad-1' }), 'missing customer_id']
      );
    });
  });
});
