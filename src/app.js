const express = require('express');
const app = express();
const logger = require('./shared/logger');

app.use(express.json());

const { pools, controlPool } = require('./shared/pool');

app.get('/health', async (req, res) => {
  try {
    const shardChecks = pools.map((pool, i) =>
      pool.query('SELECT 1').then(() => ({ name: `shard_${i}`, status: 'ok' }))
        .catch(() => ({ name: `shard_${i}`, status: 'error' }))
    );
    const controlCheck = controlPool.query('SELECT 1')
      .then(() => ({ name: 'control_db', status: 'ok' }))
      .catch(() => ({ name: 'control_db', status: 'error' }));

    const results = await Promise.all([...shardChecks, controlCheck]);
    const allOk = results.every((r) => r.status === 'ok');

    res.status(allOk ? 200 : 503).json({
      status: allOk ? 'ok' : 'degraded',
      databases: results,
    });
  } catch (err) {
    logger.error('Health check failed', { error: err.message });
    res.status(503).json({ status: 'error', details: err.message });
  }
});

app.use('/', require('./orders/routes'));

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.originalUrl });
});

app.use((err, req, res, next) => {
  logger.error('Uncaught Express error', { path: req.originalUrl, error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

module.exports = app;