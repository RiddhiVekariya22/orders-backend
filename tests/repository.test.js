const mockPools = [
  { query: jest.fn() },
  { query: jest.fn() },
  { query: jest.fn() },
  { query: jest.fn() },
];

jest.mock('../src/shared/pool', () => ({
  getPoolForShard: jest.fn((index) => mockPools[index]),
}));

jest.mock('../src/shared/db', () => ({
  withTransaction: jest.fn((pool, callback) => callback(pool)),
}));

const {
  findByOrderId,
  searchOrders,
  bulkInsertOrders,
} = require('../src/orders/repository');

describe('orders repository module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPools.forEach((p) => p.query.mockResolvedValue({ rows: [] }));
  });

  describe('findByOrderId', () => {
    it('queries all 4 shards and returns matching order', async () => {
      const targetOrder = { order_id: 'ord-123', status: 'completed' };
      mockPools[2].query.mockResolvedValueOnce({ rows: [targetOrder] });

      const result = await findByOrderId('ord-123');

      expect(result).toEqual(targetOrder);
      mockPools.forEach((pool) => {
        expect(pool.query).toHaveBeenCalledWith(
          'SELECT * FROM orders WHERE order_id = $1',
          ['ord-123']
        );
      });
    });

    it('returns null when order is not found in any shard', async () => {
      const result = await findByOrderId('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('searchOrders', () => {
    it('fans out to all shards when no date range is provided and returns paginated result', async () => {
      mockPools[0].query.mockResolvedValueOnce({
        rows: [{ order_id: '1', order_date: '2026-05-10T00:00:00Z', customer_id: 'cust-1' }],
      });
      mockPools[3].query.mockResolvedValueOnce({
        rows: [{ order_id: '2', order_date: '2026-05-12T00:00:00Z', customer_id: 'cust-1' }],
      });

      const result = await searchOrders({ customerId: 'cust-1' });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].order_id).toBe('2'); // sorted desc by order_date
      expect(result.data[1].order_id).toBe('1');
      expect(result.pagination).toEqual({
        nextCursor: null,
        hasNextPage: false,
        limit: 20,
      });

      mockPools.forEach((p) => {
        expect(p.query).toHaveBeenCalledWith(
          'SELECT * FROM orders WHERE customer_id = $1 ORDER BY order_date DESC LIMIT 21',
          ['cust-1']
        );
      });
    });

    it('queries only targeted shards when date range is specified', async () => {
      // 2026-01-01 to 2026-01-31 touches Shard 0 only
      mockPools[0].query.mockResolvedValueOnce({
        rows: [{ order_id: 'jan-1', order_date: '2026-01-15T00:00:00Z' }],
      });

      const result = await searchOrders({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });

      expect(result.data).toHaveLength(1);
      expect(mockPools[0].query).toHaveBeenCalledTimes(1);
      expect(mockPools[1].query).not.toHaveBeenCalled();
      expect(mockPools[2].query).not.toHaveBeenCalled();
      expect(mockPools[3].query).not.toHaveBeenCalled();
    });

    it('includes cursor filter when cursor query parameter is provided', async () => {
      mockPools[0].query.mockResolvedValueOnce({
        rows: [{ order_id: 'jan-1', order_date: '2026-01-15T00:00:00Z' }],
      });

      const result = await searchOrders({
        customerId: 'cust-1',
        cursor: '2026-02-01T00:00:00Z',
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(mockPools[0].query).toHaveBeenCalledWith(
        'SELECT * FROM orders WHERE customer_id = $1 AND order_date < $2 ORDER BY order_date DESC LIMIT 11',
        ['cust-1', '2026-02-01T00:00:00Z']
      );
    });
  });

  describe('bulkInsertOrders', () => {
    it('groups rows by target shard index and performs bulk inserts', async () => {
      const rows = [
        {
          order_id: 'o-1',
          customer_id: 'c-1',
          order_date: '2026-01-10T00:00:00Z', // Shard 0
          order_amount: '100',
          status: 'completed',
        },
        {
          order_id: 'o-2',
          customer_id: 'c-2',
          order_date: '2026-02-10T00:00:00Z', // Shard 1
          order_amount: '200',
          status: 'pending',
        },
      ];

      await bulkInsertOrders(rows);

      expect(mockPools[0].query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO orders'),
        ['o-1', 'c-1', '2026-01-10T00:00:00Z', '100', 'completed']
      );
      expect(mockPools[1].query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO orders'),
        ['o-2', 'c-2', '2026-02-10T00:00:00Z', '200', 'pending']
      );
      expect(mockPools[2].query).not.toHaveBeenCalled();
      expect(mockPools[3].query).not.toHaveBeenCalled();
    });
  });
});
