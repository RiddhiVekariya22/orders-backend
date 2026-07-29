const { withTransaction } = require('../src/shared/db');

describe('db module', () => {
  describe('withTransaction', () => {
    let mockClient;
    let mockPool;

    beforeEach(() => {
      mockClient = {
        query: jest.fn().mockResolvedValue({}),
        release: jest.fn(),
      };
      mockPool = {
        connect: jest.fn().mockResolvedValue(mockClient),
      };
    });

    it('executes BEGIN, runs fn, COMMITS, and releases client on success', async () => {
      const callback = jest.fn().mockResolvedValue('test-result');

      const result = await withTransaction(mockPool, callback);

      expect(result).toBe('test-result');
      expect(mockPool.connect).toHaveBeenCalledTimes(1);
      expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(callback).toHaveBeenCalledWith(mockClient);
      expect(mockClient.query).toHaveBeenNthCalledWith(2, 'COMMIT');
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('executes ROLLBACK, releases client, and rethrows on error', async () => {
      const error = new Error('Database transaction failure');
      const callback = jest.fn().mockRejectedValue(error);

      await expect(withTransaction(mockPool, callback)).rejects.toThrow('Database transaction failure');

      expect(mockPool.connect).toHaveBeenCalledTimes(1);
      expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(callback).toHaveBeenCalledWith(mockClient);
      expect(mockClient.query).toHaveBeenNthCalledWith(2, 'ROLLBACK');
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });
  });
});
