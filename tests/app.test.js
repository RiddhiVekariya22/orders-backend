const http = require('http');

const mockPools = [
  { query: jest.fn() },
  { query: jest.fn() },
  { query: jest.fn() },
  { query: jest.fn() },
];
const mockControlPool = { query: jest.fn() };

jest.mock('../src/shared/pool', () => ({
  pools: mockPools,
  controlPool: mockControlPool,
}));

jest.mock('../src/orders/routes', () => {
  const express = require('express');
  const router = express.Router();
  router.get('/test-route', (req, res) => res.json({ message: 'ok' }));
  return router;
});

const app = require('../src/app');

function makeRequest(server, options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

describe('Express app module', () => {
  let server;
  let port;

  beforeAll((done) => {
    server = app.listen(0, () => {
      port = server.address().port;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('returns 200 when all database pools respond successfully', async () => {
      mockPools.forEach((p) => p.query.mockResolvedValueOnce({}));
      mockControlPool.query.mockResolvedValueOnce({});

      const response = await makeRequest(server, {
        hostname: 'localhost',
        port,
        path: '/health',
        method: 'GET',
      });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.databases).toHaveLength(5);
    });

    it('returns 503 degraded when a database pool fails', async () => {
      mockPools[0].query.mockResolvedValueOnce({});
      mockPools[1].query.mockRejectedValueOnce(new Error('Connection lost'));
      mockPools[2].query.mockResolvedValueOnce({});
      mockPools[3].query.mockResolvedValueOnce({});
      mockControlPool.query.mockResolvedValueOnce({});

      const response = await makeRequest(server, {
        hostname: 'localhost',
        port,
        path: '/health',
        method: 'GET',
      });

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('degraded');
    });
  });

  describe('404 Not Found handling', () => {
    it('returns 404 for unknown endpoints', async () => {
      const response = await makeRequest(server, {
        hostname: 'localhost',
        port,
        path: '/non-existent-route',
        method: 'GET',
      });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: 'Route not found',
        path: '/non-existent-route',
      });
    });
  });
});
