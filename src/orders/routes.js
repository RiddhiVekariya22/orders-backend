const express = require('express');
const router = express.Router();
const controller = require('./controller');
const { parseFileUpload } = require('../shared/upload-middleware');
const { validateCSVFileMiddleware } = require('./validator');

router.post('/upload-orders', parseFileUpload, validateCSVFileMiddleware, controller.uploadOrders);
router.get('/orders/:orderId', controller.getOrder);
router.get('/orders', controller.getOrders);
router.get('/jobs/:jobId', controller.getJobStatus);

module.exports = router;
