jest.mock('../src/orders/parser', () => ({
  processStream: jest.fn(),
}));

jest.mock('../src/orders/repository', () => ({
  bulkInsertOrders: jest.fn(),
}));

jest.mock('../src/orders/jobs.repository', () => ({
  getJob: jest.fn(),
  updateJobProgress: jest.fn(),
  setJobStatus: jest.fn(),
  insertRejectedOrders: jest.fn(),
}));

jest.mock('../src/shared/gcs-adapter', () => ({
  getReadStream: jest.fn(),
}));

const { processStream } = require('../src/orders/parser');
const { bulkInsertOrders } = require('../src/orders/repository');
const {
  getJob,
  updateJobProgress,
  setJobStatus,
  insertRejectedOrders,
} = require('../src/orders/jobs.repository');
const { getReadStream } = require('../src/shared/gcs-adapter');
const { runJob } = require('../src/orders/job-runner');

describe('job-runner module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('runJob', () => {
    it('executes job pipeline cleanly from processing to done', async () => {
      const mockJob = { id: 'job-1', gcs_path: 'local://file.csv' };
      getJob.mockResolvedValueOnce(mockJob);
      getReadStream.mockReturnValueOnce({});

      processStream.mockImplementationOnce(async (stream, { onBatch, onInvalid }) => {
        await onBatch([{ order_id: 'o-1' }]);
        await onInvalid([{ raw_row: {}, reason: 'invalid date' }]);
        return { totalValid: 1, totalInvalid: 1 };
      });

      await runJob('job-1');

      expect(setJobStatus).toHaveBeenNthCalledWith(1, 'job-1', 'processing');
      expect(getJob).toHaveBeenCalledWith('job-1');
      expect(getReadStream).toHaveBeenCalledWith('local://file.csv');

      expect(bulkInsertOrders).toHaveBeenCalledWith([{ order_id: 'o-1' }]);
      expect(updateJobProgress).toHaveBeenCalledWith('job-1', { processedDelta: 1 });

      expect(insertRejectedOrders).toHaveBeenCalledWith('job-1', [{ raw_row: {}, reason: 'invalid date' }]);
      expect(updateJobProgress).toHaveBeenCalledWith('job-1', { failedDelta: 1 });

      expect(setJobStatus).toHaveBeenNthCalledWith(2, 'job-1', 'done');
    });

    it('sets job status to failed if job is missing', async () => {
      getJob.mockResolvedValueOnce(null);

      await expect(runJob('job-missing')).rejects.toThrow('Job job-missing not found in control_db');
      expect(setJobStatus).toHaveBeenNthCalledWith(1, 'job-missing', 'processing');
      expect(setJobStatus).toHaveBeenNthCalledWith(2, 'job-missing', 'failed', 'Job job-missing not found in control_db');
    });

    it('sets job status to failed when processing stream throws an error', async () => {
      const mockJob = { id: 'job-err', gcs_path: 'local://file.csv' };
      getJob.mockResolvedValueOnce(mockJob);
      getReadStream.mockReturnValueOnce({});

      processStream.mockRejectedValueOnce(new Error('CSV parse error'));

      await expect(runJob('job-err')).rejects.toThrow('CSV parse error');
      expect(setJobStatus).toHaveBeenNthCalledWith(2, 'job-err', 'failed', 'CSV parse error');
    });
  });
});
