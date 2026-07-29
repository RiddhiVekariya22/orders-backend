const { getPoolForShard } = require('../shared/pool');
const { getShardIndex } = require('./shard-router');
const { withTransaction } = require('../shared/db');

async function insertOrder(order) {
  const shardIndex = getShardIndex(order.order_date);
  const pool = getPoolForShard(shardIndex);

  await pool.query(
    `INSERT INTO orders (order_id, customer_id, order_date, order_amount, status)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (order_id) DO NOTHING`,
    [order.order_id, order.customer_id, order.order_date, order.order_amount, order.status]
  );

  return shardIndex;
}

// Fan-out: order_id alone doesn't tell us the shard, so query all 4 in parallel
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

// Fan-out: customer's orders are scattered across month-based shards
async function findByCustomerId(customerId) {
  const pools = [0, 1, 2, 3].map(getPoolForShard);
  const results = await Promise.all(
    pools.map((pool) =>
      pool.query('SELECT * FROM orders WHERE customer_id = $1', [customerId])
    )
  );
  return results.flatMap((r) => r.rows);
}

// Targeted: date range maps to specific shards via getShardIndex per month touched
async function findByDateRange(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const shardIndexes = new Set();
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    shardIndexes.add(getShardIndex(cursor.toISOString()));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const pools = [...shardIndexes].map(getPoolForShard);
  const results = await Promise.all(
    pools.map((pool) =>
      pool.query(
        'SELECT * FROM orders WHERE order_date BETWEEN $1 AND $2 ORDER BY order_date',
        [startDate, endDate]
      )
    )
  );
  return results.flatMap((r) => r.rows);
}

// Bulk insert: group rows by shard, fire one multi-row INSERT per shard
async function bulkInsertOrders(rows) {
  // Group rows by their target shard
  const shardGroups = new Map();
  for (const row of rows) {
    const idx = getShardIndex(row.order_date);
    if (!shardGroups.has(idx)) shardGroups.set(idx, []);
    shardGroups.get(idx).push(row);
  }

  // One transactional INSERT per shard, all in parallel
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
  insertOrder,
  bulkInsertOrders,
  findByOrderId,
  findByCustomerId,
  findByDateRange,
};