const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const controller = require('./controller');
const { validateCSVFileMiddleware } = require('./validator');

const uploadDir = path.join(__dirname, '../../tmp-uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ dest: uploadDir });

router.post('/upload-orders', upload.single('file'), validateCSVFileMiddleware, controller.uploadOrders);
router.get('/orders/:orderId', controller.getOrder);
router.get('/orders', controller.getOrders);
router.get('/jobs/:jobId', controller.getJobStatus);

module.exports = router;
