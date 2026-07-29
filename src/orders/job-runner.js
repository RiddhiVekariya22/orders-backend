const { processStream } = require('./parser');
const { bulkInsertOrders } = require('./repository');
const { getJob, updateJobProgress, setJobStatus, insertRejectedOrders } = require('./jobs.repository');
const { getReadStream } = require('../shared/gcs-adapter');
const logger = require('../shared/logger');

async function runJob(jobId) {
  logger.info('Job processing started', { jobId });
  await setJobStatus(jobId, 'processing');

  try {
    const job = await getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found in control_db`);
    }

    logger.info('Opening storage read stream for job', { jobId, gcsPath: job.gcs_path });
    const stream = getReadStream(job.gcs_path);

    const { totalValid, totalInvalid } = await processStream(stream, {
      onBatch: async (rows) => {
        try {
          await bulkInsertOrders(rows);
          await updateJobProgress(jobId, { processedDelta: rows.length });
          logger.info('Processed valid order batch', { jobId, batchSize: rows.length });
        } catch (dbErr) {
          logger.error('Database insert batch failed', { jobId, batchSize: rows.length, error: dbErr.message });
          throw new Error(`Database batch insert failed: ${dbErr.message}`);
        }
      },
      onInvalid: async (rows) => {
        try {
          await insertRejectedOrders(jobId, rows);
          await updateJobProgress(jobId, { failedDelta: rows.length });
          logger.warn('Persisted failed records to rejected_orders', {
            jobId,
            failedCount: rows.length,
            sampleReasons: rows.slice(0, 3).map((r) => r.reason),
          });
        } catch (dbErr) {
          logger.error('Failed to insert rejected orders', { jobId, count: rows.length, error: dbErr.message });
          throw new Error(`Rejected orders insert failed: ${dbErr.message}`);
        }
      },
    });

    await setJobStatus(jobId, 'done');
    logger.info('Job processing completed successfully', { jobId, totalValid, totalInvalid });
  } catch (err) {
    logger.error('Job processing failed', { jobId, error: err.message });
    await setJobStatus(jobId, 'failed', err.message);
    throw err;
  }
}

module.exports = { runJob };
