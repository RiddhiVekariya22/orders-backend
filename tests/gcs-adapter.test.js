const fs = require('fs');
const path = require('path');
const { uploadToGCS, getReadStream } = require('../src/shared/gcs-adapter');

describe('gcs-adapter module', () => {
  const tmpDir = path.join(__dirname, '../tmp-uploads/test-gcs');
  const sampleFile = path.join(tmpDir, 'test-sample.txt');

  beforeAll(() => {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    fs.writeFileSync(sampleFile, 'hello gcs adapter');
  });

  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('uploadToGCS in local fallback mode', () => {
    it('saves file to local-gcs-fallback and returns local:// URI', async () => {
      const gcsUri = await uploadToGCS(sampleFile, 'my-test.txt');
      expect(gcsUri).toMatch(/^local:\/\/\d+-my-test\.txt$/);

      const filename = gcsUri.replace('local://', '');
      const savedPath = path.join(__dirname, '../local-gcs-fallback', filename);
      expect(fs.existsSync(savedPath)).toBe(true);

      // Clean up fallback file
      fs.unlinkSync(savedPath);
    });
  });

  describe('getReadStream in local fallback mode', () => {
    it('creates readable stream for local:// prefix', (done) => {
      const fallbackDir = path.join(__dirname, '../local-gcs-fallback');
      if (!fs.existsSync(fallbackDir)) fs.mkdirSync(fallbackDir, { recursive: true });

      const testFilename = `test-read-stream-${Date.now()}.txt`;
      const localFile = path.join(fallbackDir, testFilename);
      fs.writeFileSync(localFile, 'stream content');

      const stream = getReadStream(`local://${testFilename}`);
      let content = '';
      stream.on('data', (chunk) => {
        content += chunk.toString();
      });
      stream.on('end', () => {
        expect(content).toBe('stream content');
        fs.unlinkSync(localFile);
        done();
      });
    });
  });
});
