function validateRow(row) {
    const errors = [];

    if (!row.order_id || String(row.order_id).trim() === '') {
        errors.push('missing order_id');
    }
    if (!row.customer_id || String(row.customer_id).trim() === '') {
        errors.push('missing customer_id');
    }
    if (!row.order_date || isNaN(Date.parse(row.order_date))) {
        errors.push('invalid order_date');
    }
    const amount = parseFloat(row.order_amount);
    if (row.order_amount === undefined || isNaN(amount) || amount < 0) {
        errors.push('invalid order_amount');
    }
    if (!row.status || String(row.status).trim() === '') {
        errors.push('missing status');
    }

    return errors.length > 0 ? errors : null;
}

module.exports = { validateRow };