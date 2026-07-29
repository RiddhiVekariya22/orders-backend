const fs = require('fs');

const REQUIRED_HEADERS = ['order_id', 'customer_id', 'order_date', 'order_amount', 'status'];

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

async function validateCSVFile(filePath) {
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
        throw new Error('Uploaded file is empty');
    }

    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8', start: 0, end: 1024 });
    let firstChunk = '';
    for await (const chunk of fileStream) {
        firstChunk += chunk;
        if (firstChunk.includes('\n') || firstChunk.includes('\r')) break;
    }

    const firstLine = firstChunk.split(/\r?\n/)[0];
    if (!firstLine || !firstLine.trim()) {
        throw new Error('CSV file contains no header row');
    }

    const headers = firstLine.split(',').map((h) => h.trim().replace(/^[\uFEFF]/, ''));
    const missingHeaders = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
    if (missingHeaders.length > 0) {
        throw new Error(`Missing expected CSV headers: ${missingHeaders.join(', ')}`);
    }
}

async function validateCSVFileMiddleware(req, res, next) {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    try {
        await validateCSVFile(req.file.path);
        next();
    } catch (err) {
        return res.status(400).json({ error: 'Upload failed', details: err.message });
    }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(str) {
    return UUID_REGEX.test(str);
}

module.exports = { validateRow, validateCSVFile, validateCSVFileMiddleware, isValidUUID };