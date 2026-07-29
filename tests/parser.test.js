const { Readable } = require('stream');
const { processStream } = require('../src/orders/parser');

describe('parser module', () => {
  describe('processStream', () => {
    it('processes stream and separates valid and invalid rows into batches', async () => {
      const csvData = [
        'order_id,customer_id,order_date,order_amount,status\n',
        'id-1,cust-1,2026-01-01T00:00:00Z,100.0,completed\n',
        'id-2,cust-2,invalid-date,50.0,pending\n',
        'id-3,cust-3,2026-02-01T00:00:00Z,200.0,completed\n',
      ].join('');

      const stream = Readable.from(csvData);
      const onBatch = jest.fn();
      const onInvalid = jest.fn();

      const result = await processStream(stream, {
        onBatch,
        onInvalid,
        batchSize: 2,
      });

      expect(result).toEqual({ totalValid: 2, totalInvalid: 1 });
      expect(onBatch).toHaveBeenCalledWith([
        {
          order_id: 'id-1',
          customer_id: 'cust-1',
          order_date: '2026-01-01T00:00:00Z',
          order_amount: '100.0',
          status: 'completed',
        },
        {
          order_id: 'id-3',
          customer_id: 'cust-3',
          order_date: '2026-02-01T00:00:00Z',
          order_amount: '200.0',
          status: 'completed',
        },
      ]);

      expect(onInvalid).toHaveBeenCalledWith([
        {
          raw_row: {
            order_id: 'id-2',
            customer_id: 'cust-2',
            order_date: 'invalid-date',
            order_amount: '50.0',
            status: 'pending',
          },
          reason: 'invalid order_date',
        },
      ]);
    });

    it('flushes batches when reaching specified batch size', async () => {
      const rows = ['order_id,customer_id,order_date,order_amount,status\n'];
      for (let i = 1; i <= 5; i++) {
        rows.push(`id-${i},cust-${i},2026-01-01T00:00:00Z,10.0,completed\n`);
      }
      const stream = Readable.from(rows.join(''));

      const onBatch = jest.fn();
      const onInvalid = jest.fn();

      const result = await processStream(stream, {
        onBatch,
        onInvalid,
        batchSize: 2,
      });

      expect(result).toEqual({ totalValid: 5, totalInvalid: 0 });
      // With 5 valid rows and batchSize = 2: 2 batches of size 2, 1 final batch of size 1
      expect(onBatch).toHaveBeenCalledTimes(3);
    });

    it('rejects on stream parser error', async () => {
      const malformedCSV = 'order_id,customer_id\n"unclosed quote';
      const stream = Readable.from([malformedCSV]);

      await expect(
        processStream(stream, { onBatch: jest.fn(), onInvalid: jest.fn() })
      ).rejects.toThrow();
    });
  });
});
