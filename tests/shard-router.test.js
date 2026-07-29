const { getShardIndex, getShardsForDateRange } = require('../src/orders/shard-router');

describe('shard-router module', () => {
  describe('getShardIndex', () => {
    it('returns month % 4 by default', () => {
      // Jan (month 0) => 0
      expect(getShardIndex('2026-01-15T00:00:00Z')).toBe(0);
      // Feb (month 1) => 1
      expect(getShardIndex('2026-02-15T00:00:00Z')).toBe(1);
      // Mar (month 2) => 2
      expect(getShardIndex('2026-03-15T00:00:00Z')).toBe(2);
      // Apr (month 3) => 3
      expect(getShardIndex('2026-04-15T00:00:00Z')).toBe(3);
      // May (month 4) => 0
      expect(getShardIndex('2026-05-15T00:00:00Z')).toBe(0);
    });

    it('respects custom numShards argument', () => {
      // May (month 4) % 3 => 1
      expect(getShardIndex('2026-05-15T00:00:00Z', 3)).toBe(1);
    });
  });

  describe('getShardsForDateRange', () => {
    it('returns single shard when date range is within single month', () => {
      const shards = getShardsForDateRange('2026-01-01', '2026-01-20');
      expect(shards).toEqual([0]);
    });

    it('returns multiple shards for multi-month range', () => {
      const shards = getShardsForDateRange('2026-01-15', '2026-03-10');
      expect(shards).toEqual([0, 1, 2]);
    });

    it('returns all 4 shards when date range spans 4 or more distinct months', () => {
      const shards = getShardsForDateRange('2026-01-01', '2026-06-30');
      expect(shards).toEqual([0, 1, 2, 3]);
    });

    it('handles year transitions correctly', () => {
      const shards = getShardsForDateRange('2025-12-15', '2026-01-15');
      // Dec (month 11) % 4 = 3, Jan (month 0) % 4 = 0
      expect(shards).toEqual([3, 0]);
    });
  });
});
