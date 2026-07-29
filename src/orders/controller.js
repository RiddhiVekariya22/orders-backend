const { handleUpload } = require('./upload.service');
const { findByOrderId, searchOrders } = require('./repository');
const { getJob } = require('./jobs.repository');
const { isValidUUID } = require('./validator');
const logger = require('../shared/logger');

async function uploadOrders(req, res) {
  logger.info('File upload request received', { filename: req.file.originalname, size: req.file.size });
  try {
    const jobId = await handleUpload(req.file.path, req.file.originalname);
    logger.info('File uploaded and processing job created', { jobId, filename: req.file.originalname });
    res.status(202).json({ jobId, status: 'pending' });
  } catch (err) {
    logger.error('Upload handling failed', { filename: req.file.originalname, error: err.message });
    res.status(500).json({ error: 'Upload failed', details: err.message });
  }
}

async function getOrder(req, res) {
  const { orderId } = req.params;
  if (!isValidUUID(orderId)) {
    return res.status(400).json({ error: 'Invalid orderId — must be a UUID' });
  }
  try {
    const order = await findByOrderId(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    logger.error('getOrder failed', { orderId, error: err.message });
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}

async function getOrders(req, res) {
  const { customerId, startDate, endDate } = req.query;

  // Validate parameter presence: must provide either customerId or both startDate & endDate
  const hasCustomerId = Boolean(customerId);
  const hasDateRange = Boolean(startDate && endDate);

  if (!hasCustomerId && !hasDateRange) {
    return res.status(400).json({
      error: 'Provide either customerId, or both startDate and endDate (or all parameters together)',
    });
  }

  try {
    const orders = await searchOrders({ customerId, startDate, endDate });
    return res.json(orders);
  } catch (err) {
    logger.error('getOrders failed', { customerId, startDate, endDate, error: err.message });
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}

async function getJobStatus(req, res) {
  const { jobId } = req.params;
  if (!isValidUUID(jobId)) {
    return res.status(400).json({ error: 'Invalid jobId — must be a UUID' });
  }
  try {
    const job = await getJob(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err) {
    logger.error('getJobStatus failed', { jobId, error: err.message });
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}

module.exports = { uploadOrders, getOrder, getOrders, getJobStatus };
