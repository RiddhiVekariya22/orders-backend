function getShardIndex(orderDate, numShards = 4) {
    const date = new Date(orderDate);
    const month = date.getUTCMonth();
    return month % numShards;
}

module.exports = { getShardIndex };

//could change sharding to be on order_date, would make more sense 