const path = require('path');
const { handleUpload } = require('./upload.service');
const { findByOrderId, findByCustomerId, findByDateRange } = require('./repository');
const { getJob } = require('./jobs.repository');

async function uploadOrders(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  try {
    const jobId = await handleUpload(req.file.path, req.file.originalname);
    res.status(202).json({ jobId, status: 'pending' });
  } catch (err) {
    console.error('Upload failed:', err);
    res.status(500).json({ error: 'Upload failed', details: err.message });
  }
}

async function getOrder(req, res) {
  const order = await findByOrderId(req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
}

async function getOrders(req, res) {
  const { customerId, startDate, endDate } = req.query;

  if (customerId) {
    const orders = await findByCustomerId(customerId);
    return res.json(orders);
  }

  if (startDate && endDate) {
    const orders = await findByDateRange(startDate, endDate);
    return res.json(orders);
  }

  return res.status(400).json({
    error: 'Provide either customerId, or both startDate and endDate',
  });
}

async function getJobStatus(req, res) {
  const job = await getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
}

module.exports = { uploadOrders, getOrder, getOrders, getJobStatus };
