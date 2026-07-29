function getShardIndex(orderDate, numShards = 4) {
    const date = new Date(orderDate);
    const month = date.getUTCMonth();
    return month % numShards;
}


function getShardsForDateRange(startDate, endDate, numShards = 4) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const shardIndexes = new Set();
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));

    while (cursor <= end) {
        shardIndexes.add(getShardIndex(cursor.toISOString(), numShards));
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    return [...shardIndexes];
}

module.exports = { getShardIndex, getShardsForDateRange };