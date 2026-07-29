const { handleUpload } = require('./upload.service');
const { findByOrderId, findByCustomerId, findByDateRange } = require('./repository');
const { getJob } = require('./jobs.repository');
const { validateCSVFile, isValidUUID } = require('./validator');

async function uploadOrders(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  try {
    await validateCSVFile(req.file.path);
    const jobId = await handleUpload(req.file.path, req.file.originalname);
    res.status(202).json({ jobId, status: 'pending' });
  } catch (err) {
    console.error('Upload failed:', err);
    res.status(400).json({ error: 'Upload failed', details: err.message });
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
    console.error('getOrder failed:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
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
  const { jobId } = req.params;
  if (!isValidUUID(jobId)) {
    return res.status(400).json({ error: 'Invalid jobId — must be a UUID' });
  }
  try {
    const job = await getJob(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err) {
    console.error('getJobStatus failed:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}

module.exports = { uploadOrders, getOrder, getOrders, getJobStatus };
