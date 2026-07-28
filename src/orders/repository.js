const { getPoolForShard } = require('../shared/pool');
const { getShardIndex } = require('./shard-router');

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

module.exports = { insertOrder };