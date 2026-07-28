const { createJob } = require('./jobs.repository');
const { runJob } = require('./job-runner');

async function uploadToGCS(localFilePath, originalFilename) {
  return `gs://orders-bucket/${originalFilename}`;
}

async function handleUpload(localFilePath, originalFilename) {
  const gcsPath = await uploadToGCS(localFilePath, originalFilename); // Hour 8 logic, stub if not built yet
  const jobId = await createJob(gcsPath);

  // TRIGGER MECHANISM — this is the one part that changes if you move to BullMQ later
  setImmediate(() => {
    runJob(jobId, localFilePath).catch((err) => {
      console.error(`Job ${jobId} failed:`, err.message);
    });
  });

  return jobId;
}

module.exports = { handleUpload, uploadToGCS };
