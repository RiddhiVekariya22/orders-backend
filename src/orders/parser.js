const fs = require('fs');
const { parse } = require('csv-parse');
const { validateRow } = require('./validator');

const BATCH_SIZE = 500;

/**
 * Streams a CSV file, validates each row, and calls onBatch(validRows)
 * and onInvalid(invalidRows) as batches fill up. Returns final counts.
 */
function processFile(filePath, { onBatch, onInvalid }) {
  return new Promise((resolve, reject) => {
    let validBatch = [];
    let invalidBatch = [];
    let totalValid = 0;
    let totalInvalid = 0;

    const parser = fs.createReadStream(filePath).pipe(
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

        if (validBatch.length >= BATCH_SIZE) {
          onBatch([...validBatch]);
          validBatch = [];
        }
        if (invalidBatch.length >= BATCH_SIZE) {
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

module.exports = { processFile, BATCH_SIZE };
