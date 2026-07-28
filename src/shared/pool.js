const { Pool } = require('pg');
require('dotenv').config();

const pools = [
    new Pool({ connectionString: process.env.SHARD_0_URL }),
    new Pool({ connectionString: process.env.SHARD_1_URL }),
    new Pool({ connectionString: process.env.SHARD_2_URL }),
    new Pool({ connectionString: process.env.SHARD_3_URL }),
];

function getPoolForShard(index) {
    return pools[index];
}

module.exports = { getPoolForShard, pools };