const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

const uploadDir = path.join(__dirname, '../../tmp-uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 50MB file size limit for uploads
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 50 * 1024 * 1024 },
});

/**
 * Middleware that intercepts and parses single file uploads ('file' field)
 * and returns structured JSON error responses on upload failures.
 */
function parseFileUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        logger.warn('File upload constraint error', { code: err.code, message: err.message });
        return res.status(400).json({ error: 'File upload error', details: err.message });
      }
      logger.error('File upload system failure', { error: err.message });
      return res.status(500).json({ error: 'Failed to process file upload', details: err.message });
    }
    next();
  });
}

module.exports = { parseFileUpload };
