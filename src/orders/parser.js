const fs = require('fs');
const { parse } = require('csv-parse');
const { validateRow } = require('./validator');

const BATCH_SIZE = 500;

/**
 * Core streaming parser. Accepts any Node.js Readable stream,
 * validates each row, and calls onBatch/onInvalid as batches fill up.
 * Returns final counts.
 */
function processStream(readableStream, { onBatch, onInvalid, batchSize = BATCH_SIZE }) {
  return new Promise((resolve, reject) => {
    let validBatch = [];
    let invalidBatch = [];
    let totalValid = 0;
    let totalInvalid = 0;

    const parser = readableStream.pipe(
      parse({ columns: true, trim: true, skip_empty_lines: true })
    );

    parser.on('readable', function () {
      let row;
      while ((row = parser.read()) !== null) {
        const errors = validateRow(row);
        if (errors) {
          invalidBatch.push({ raw_row: row, reason: errors.join('; ') });
          totalInvalid++;
        } else {
          validBatch.push(row);
          totalValid++;
        }

        if (validBatch.length >= batchSize) {
          onBatch([...validBatch]);
          validBatch = [];
        }
        if (invalidBatch.length >= batchSize) {
          onInvalid([...invalidBatch]);
          invalidBatch = [];
        }
      }
    });

    parser.on('error', (err) => reject(err));

    parser.on('end', () => {
      if (validBatch.length > 0) onBatch([...validBatch]);
      if (invalidBatch.length > 0) onInvalid([...invalidBatch]);
      resolve({ totalValid, totalInvalid });
    });
  });
}


module.exports = { processStream, BATCH_SIZE };
