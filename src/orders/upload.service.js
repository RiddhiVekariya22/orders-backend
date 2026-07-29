const { createJob } = require('./jobs.repository');
const { runJob } = require('./job-runner');
const { uploadToGCS } = require('../shared/gcs-adapter');

async function handleUpload(localFilePath, originalFilename) {
  const gcsPath = await uploadToGCS(localFilePath, originalFilename);
  const jobId = await createJob(gcsPath);

  setImmediate(() => {
    runJob(jobId).catch((err) => {
      console.error(`Job ${jobId} failed:`, err.message);
    });
  });

  return jobId;
}

module.exports = { handleUpload };
