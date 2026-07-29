const { processStream } = require('./parser');
const { bulkInsertOrders } = require('./repository');
const { getJob, updateJobProgress, setJobStatus, insertRejectedOrders } = require('./jobs.repository');
const { getReadStream } = require('../shared/gcs-adapter');

async function runJob(jobId) {
  await setJobStatus(jobId, 'processing');

  try {
    const job = await getJob(jobId);
    const stream = getReadStream(job.gcs_path);

    await processStream(stream, {
      onBatch: async (rows) => {
        await bulkInsertOrders(rows);
        await updateJobProgress(jobId, { processedDelta: rows.length });
      },
      onInvalid: async (rows) => {
        await insertRejectedOrders(jobId, rows);
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
