jest.mock('../src/orders/jobs.repository', () => ({
  createJob: jest.fn(),
}));

jest.mock('../src/orders/job-runner', () => ({
  runJob: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/shared/gcs-adapter', () => ({
  uploadToGCS: jest.fn(),
}));

const { createJob } = require('../src/orders/jobs.repository');
const { runJob } = require('../src/orders/job-runner');
const { uploadToGCS } = require('../src/shared/gcs-adapter');
const { handleUpload } = require('../src/orders/upload.service');

describe('upload.service module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleUpload', () => {
    it('uploads file, creates job record, schedules background runner, and returns jobId', async () => {
      uploadToGCS.mockResolvedValueOnce('local://12345-orders.csv');
      createJob.mockResolvedValueOnce('job-uuid-123');

      const jobId = await handleUpload('/tmp/upload-file.csv', 'orders.csv');

      expect(jobId).toBe('job-uuid-123');
      expect(uploadToGCS).toHaveBeenCalledWith('/tmp/upload-file.csv', 'orders.csv');
      expect(createJob).toHaveBeenCalledWith('local://12345-orders.csv');

      // Wait for setImmediate tick
      await new Promise((resolve) => setImmediate(resolve));
      expect(runJob).toHaveBeenCalledWith('job-uuid-123');
    });
  });
});
