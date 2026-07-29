const { controlPool } = require('../shared/pool');

async function createJob(gcsPath) {
    const result = await controlPool.query(
        `INSERT INTO jobs (status, gcs_path) VALUES ('pending', $1) RETURNING id`,
        [gcsPath]
    );
    return result.rows[0].id;
}

async function updateJobProgress(jobId, { processedDelta = 0, failedDelta = 0 }) {
    await controlPool.query(
        `UPDATE jobs SET processed_rows = processed_rows + $1, failed_rows = failed_rows + $2, updated_at = now() WHERE id = $3`,
        [processedDelta, failedDelta, jobId]
    );
}

async function setJobStatus(jobId, status, errorMessage = null) {
    await controlPool.query(
        `UPDATE jobs SET status = $1, error_message = $2, updated_at = now() WHERE id = $3`,
        [status, errorMessage, jobId]
    );
}

async function getJob(jobId) {
    const result = await controlPool.query(`SELECT * FROM jobs WHERE id = $1`, [jobId]);
    return result.rows[0] || null;
}

async function insertRejectedOrders(jobId, rows) {
    if (!rows.length) return;
    const values = rows.map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`).join(', ');
    const params = [jobId, ...rows.flatMap((r) => [JSON.stringify(r.raw_row), r.reason])];
    await controlPool.query(
        `INSERT INTO rejected_orders (job_id, raw_row, reason) VALUES ${values}`,
        params
    );
}

module.exports = { createJob, updateJobProgress, setJobStatus, getJob, insertRejectedOrders };