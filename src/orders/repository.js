const { getPoolForShard } = require('../shared/pool');
const { getShardIndex, getShardsForDateRange } = require('./shard-router');
const { withTransaction } = require('../shared/db');

async function findByOrderId(orderId) {
  const pools = [0, 1, 2, 3].map(getPoolForShard);
  const results = await Promise.all(
    pools.map((pool) =>
      pool.query('SELECT * FROM orders WHERE order_id = $1', [orderId])
    )
  );
  for (const result of results) {
    if (result.rows.length > 0) return result.rows[0];
  }
  return null;
}

/**
 * Unified order search endpoint handler:
 * - If date range (startDate & endDate) is present, queries ONLY touched shards.
 * - If date range is NOT present, fans out to ALL 4 shards.
 * - Filters by customerId and/or date range depending on query params provided.
 */
async function searchOrders({ customerId, startDate, endDate }) {
  const targetShardIndexes = (startDate && endDate)
    ? getShardsForDateRange(startDate, endDate)
    : [0, 1, 2, 3];

  const whereClauses = [];
  const queryParams = [];

  if (customerId) {
    queryParams.push(customerId);
    whereClauses.push(`customer_id = $${queryParams.length}`);
  }

  if (startDate && endDate) {
    queryParams.push(startDate);
    whereClauses.push(`order_date >= $${queryParams.length}`);
    queryParams.push(endDate);
    whereClauses.push(`order_date <= $${queryParams.length}`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const sql = `SELECT * FROM orders ${whereSql} ORDER BY order_date DESC`;

  const pools = targetShardIndexes.map(getPoolForShard);
  const results = await Promise.all(pools.map((pool) => pool.query(sql, queryParams)));
  
  const merged = results.flatMap((r) => r.rows);
  merged.sort((a, b) => new Date(b.order_date) - new Date(a.order_date));
  return merged;
}

async function bulkInsertOrders(rows) {
  // Group rows by their target shard
  const shardGroups = new Map();
  for (const row of rows) {
    const idx = getShardIndex(row.order_date);
    if (!shardGroups.has(idx)) shardGroups.set(idx, []);
    shardGroups.get(idx).push(row);
  }

  await Promise.all(
    [...shardGroups.entries()].map(([idx, shardRows]) => {
      const pool = getPoolForShard(idx);
      const values = shardRows
        .map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`)
        .join(', ');
      const params = shardRows.flatMap((r) => [
        r.order_id, r.customer_id, r.order_date, r.order_amount, r.status,
      ]);
      return withTransaction(pool, (client) =>
        client.query(
          `INSERT INTO orders (order_id, customer_id, order_date, order_amount, status)
           VALUES ${values}
           ON CONFLICT (order_id) DO NOTHING`,
          params
        )
      );
    })
  );
}

module.exports = {
  bulkInsertOrders,
  findByOrderId,
  searchOrders,
};