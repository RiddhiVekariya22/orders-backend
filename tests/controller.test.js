jest.mock('../src/orders/upload.service', () => ({
  handleUpload: jest.fn(),
}));

jest.mock('../src/orders/repository', () => ({
  findByOrderId: jest.fn(),
  searchOrders: jest.fn(),
}));

jest.mock('../src/orders/jobs.repository', () => ({
  getJob: jest.fn(),
}));

const { handleUpload } = require('../src/orders/upload.service');
const { findByOrderId, searchOrders } = require('../src/orders/repository');
const { getJob } = require('../src/orders/jobs.repository');
const controller = require('../src/orders/controller');

describe('controller module', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { params: {}, query: {}, body: {}, file: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('uploadOrders', () => {
    it('returns 202 and jobId on successful upload handling', async () => {
      req.file = { path: '/tmp/test.csv', originalname: 'test.csv', size: 100 };
      handleUpload.mockResolvedValueOnce('job-uuid-999');

      await controller.uploadOrders(req, res);

      expect(handleUpload).toHaveBeenCalledWith('/tmp/test.csv', 'test.csv');
      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith({ jobId: 'job-uuid-999', status: 'pending' });
    });

    it('returns 500 when handleUpload throws an error', async () => {
      req.file = { path: '/tmp/test.csv', originalname: 'test.csv', size: 100 };
      handleUpload.mockRejectedValueOnce(new Error('Storage failure'));

      await controller.uploadOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Upload failed',
        details: 'Storage failure',
      });
    });
  });

  describe('getOrder', () => {
    const validUUID = 'c39a04f2-901d-407b-83ff-183709b18365';

    it('returns 400 when orderId is not a valid UUID', async () => {
      req.params.orderId = 'invalid-uuid';

      await controller.getOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid orderId — must be a UUID' });
    });

    it('returns 404 when order is not found', async () => {
      req.params.orderId = validUUID;
      findByOrderId.mockResolvedValueOnce(null);

      await controller.getOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Order not found' });
    });

    it('returns order JSON when found', async () => {
      const mockOrder = { order_id: validUUID, status: 'completed' };
      req.params.orderId = validUUID;
      findByOrderId.mockResolvedValueOnce(mockOrder);

      await controller.getOrder(req, res);

      expect(res.json).toHaveBeenCalledWith(mockOrder);
    });

    it('returns 500 when findByOrderId fails', async () => {
      req.params.orderId = validUUID;
      findByOrderId.mockRejectedValueOnce(new Error('DB failure'));

      await controller.getOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        details: 'DB failure',
      });
    });
  });

  describe('getOrders', () => {
    it('returns 400 if neither customerId nor complete date range is provided', async () => {
      req.query = { startDate: '2026-01-01' }; // missing endDate and customerId

      await controller.getOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Provide either customerId, or both startDate and endDate (or all parameters together)',
      });
    });

    it('searches and returns orders when customerId is provided', async () => {
      req.query = { customerId: 'cust-100', cursor: '2026-05-15T00:00:00Z', limit: '10' };
      const mockResult = {
        data: [{ order_id: 'ord-1' }],
        pagination: { nextCursor: null, hasNextPage: false, limit: 10 },
      };
      searchOrders.mockResolvedValueOnce(mockResult);

      await controller.getOrders(req, res);

      expect(searchOrders).toHaveBeenCalledWith({
        customerId: 'cust-100',
        startDate: undefined,
        endDate: undefined,
        cursor: '2026-05-15T00:00:00Z',
        limit: 10,
      });
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it('searches and returns orders when date range is provided', async () => {
      req.query = { startDate: '2026-01-01', endDate: '2026-01-31' };
      const mockResult = {
        data: [{ order_id: 'ord-2' }],
        pagination: { nextCursor: null, hasNextPage: false, limit: 20 },
      };
      searchOrders.mockResolvedValueOnce(mockResult);

      await controller.getOrders(req, res);

      expect(searchOrders).toHaveBeenCalledWith({
        customerId: undefined,
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        cursor: undefined,
        limit: 20,
      });
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });
  });

  describe('getJobStatus', () => {
    const validJobId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

    it('returns 400 for invalid jobId UUID', async () => {
      req.params.jobId = 'bad-id';

      await controller.getJobStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid jobId — must be a UUID' });
    });

    it('returns 404 if job does not exist', async () => {
      req.params.jobId = validJobId;
      getJob.mockResolvedValueOnce(null);

      await controller.getJobStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Job not found' });
    });

    it('returns job details when found', async () => {
      const mockJob = { id: validJobId, status: 'done' };
      req.params.jobId = validJobId;
      getJob.mockResolvedValueOnce(mockJob);

      await controller.getJobStatus(req, res);

      expect(res.json).toHaveBeenCalledWith(mockJob);
    });
  });
});
