const { processFile } = require('./parser');
const { insertOrder } = require('./repository');
const { updateJobProgress, setJobStatus } = require('./jobs.repository');

async function runJob(jobId, filePath) {
  await setJobStatus(jobId, 'processing');

  try {
    await processFile(filePath, {
      onBatch: async (rows) => {
        for (const row of rows) await insertOrder(row);
        await updateJobProgress(jobId, { processedDelta: rows.length });
      },
      onInvalid: async (rows) => {
        await updateJobProgress(jobId, { failedDelta: rows.length });
      },
    });
    await setJobStatus(jobId, 'done');
  } catch (err) {
    await setJobStatus(jobId, 'failed', err.message);
    throw err;
  }
}

module.exports = { runJob };
