const { createJob } = require('./jobs.repository');
const { runJob } = require('./job-runner');
const { uploadToGCS } = require('../shared/gcs-adapter');
const logger = require('../shared/logger');

async function handleUpload(localFilePath, originalFilename) {
  logger.info('Storing file via GCS storage adapter', { originalFilename });
  const gcsPath = await uploadToGCS(localFilePath, originalFilename);
  logger.info('File stored successfully', { gcsPath });

  const jobId = await createJob(gcsPath);
  logger.info('Job created in control_db', { jobId, gcsPath });

  setImmediate(() => {
    runJob(jobId).catch((err) => {
      logger.error('Async background job failed', { jobId, error: err.message });
    });
  });

  return jobId;
}

module.exports = { handleUpload };
