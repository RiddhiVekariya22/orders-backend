const fs = require('fs');
const path = require('path');
require('dotenv').config();

const USE_LOCAL_FALLBACK = !process.env.GCS_BUCKET_NAME;

function getStorageClient() {
  const { Storage } = require('@google-cloud/storage');
  const options = {};
  if (process.env.GCS_PROJECT_ID) options.projectId = process.env.GCS_PROJECT_ID;
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    options.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }
  return new Storage(options);
}

async function uploadToGCS(localFilePath, destFileName) {
  if (USE_LOCAL_FALLBACK) {
    const destDir = path.join(__dirname, '../../local-gcs-fallback');
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const destination = `${Date.now()}-${destFileName}`;
    fs.copyFileSync(localFilePath, path.join(destDir, destination));
    console.log('[GCS fallback] stored locally:', destination);
    return `local://${destination}`;
  }

  const storage = getStorageClient();
  const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
  const destination = `uploads/${Date.now()}-${destFileName}`;
  await bucket.upload(localFilePath, { destination });
  return `gs://${process.env.GCS_BUCKET_NAME}/${destination}`;
}

function getReadStream(gcsPath) {
  if (gcsPath.startsWith('local://')) {
    const filename = gcsPath.replace('local://', '');
    const filePath = path.join(__dirname, '../../local-gcs-fallback', filename);
    return fs.createReadStream(filePath);
  }
  // gs://bucket-name/uploads/filename
  const storage = getStorageClient();
  const withoutScheme = gcsPath.replace('gs://', '');
  const bucketName = withoutScheme.split('/')[0];
  const objectPath = withoutScheme.split('/').slice(1).join('/');
  return storage.bucket(bucketName).file(objectPath).createReadStream();
}

module.exports = { uploadToGCS, getReadStream };