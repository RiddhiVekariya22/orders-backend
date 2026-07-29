const fs = require('fs');
const path = require('path');
const {
  validateRow,
  validateCSVFile,
  validateCSVFileMiddleware,
  isValidUUID,
} = require('../src/orders/validator');

describe('validator module', () => {
  describe('validateRow', () => {
    it('returns null for a valid row', () => {
      const validRow = {
        order_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        customer_id: 'cust-101',
        order_date: '2026-05-15T10:00:00Z',
        order_amount: '150.50',
        status: 'completed',
      };
      expect(validateRow(validRow)).toBeNull();
    });

    it('collects errors for missing or invalid fields', () => {
      const invalidRow = {
        order_id: '   ',
        customer_id: '',
        order_date: 'not-a-date',
        order_amount: '-50',
        status: '',
      };
      const errors = validateRow(invalidRow);
      expect(errors).toEqual([
        'missing order_id',
        'missing customer_id',
        'invalid order_date',
        'invalid order_amount',
        'missing status',
      ]);
    });

    it('flags missing order_amount when undefined', () => {
      const rowWithoutAmount = {
        order_id: 'id-1',
        customer_id: 'cust-1',
        order_date: '2026-01-01',
        status: 'pending',
      };
      const errors = validateRow(rowWithoutAmount);
      expect(errors).toContain('invalid order_amount');
    });
  });

  describe('validateCSVFile', () => {
    const testDir = path.join(__dirname, '../tmp-uploads/test-validator');

    beforeAll(() => {
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
    });

    afterAll(() => {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('throws error for empty file', async () => {
      const emptyFile = path.join(testDir, 'empty.csv');
      fs.writeFileSync(emptyFile, '');
      await expect(validateCSVFile(emptyFile)).rejects.toThrow('Uploaded file is empty');
    });

    it('throws error for file with no header row', async () => {
      const noHeaderFile = path.join(testDir, 'noheader.csv');
      fs.writeFileSync(noHeaderFile, '\n\n');
      await expect(validateCSVFile(noHeaderFile)).rejects.toThrow('CSV file contains no header row');
    });

    it('throws error for missing required headers', async () => {
      const invalidHeaderFile = path.join(testDir, 'badheaders.csv');
      fs.writeFileSync(invalidHeaderFile, 'order_id,customer_id\n1,2');
      await expect(validateCSVFile(invalidHeaderFile)).rejects.toThrow('Missing expected CSV headers: order_date, order_amount, status');
    });

    it('resolves without error for valid CSV file headers', async () => {
      const validCSV = path.join(testDir, 'valid.csv');
      fs.writeFileSync(
        validCSV,
        'order_id,customer_id,order_date,order_amount,status\n123,cust1,2026-01-01,100,pending'
      );
      await expect(validateCSVFile(validCSV)).resolves.not.toThrow();
    });
  });

  describe('validateCSVFileMiddleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = {};
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      next = jest.fn();
    });

    it('returns 400 if no file is provided in request', async () => {
      await validateCSVFileMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'No file uploaded' });
      expect(next).not.toHaveBeenCalled();
    });

    it('calls next() when file validation succeeds', async () => {
      const validCSV = path.join(__dirname, '../tmp-uploads/test-validator-valid.csv');
      fs.writeFileSync(
        validCSV,
        'order_id,customer_id,order_date,order_amount,status\n123,cust1,2026-01-01,100,pending'
      );

      req.file = { path: validCSV, originalname: 'valid.csv' };

      await validateCSVFileMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();

      if (fs.existsSync(validCSV)) fs.unlinkSync(validCSV);
    });

    it('returns 400 if file validation fails', async () => {
      const invalidCSV = path.join(__dirname, '../tmp-uploads/test-validator-invalid.csv');
      fs.writeFileSync(invalidCSV, 'invalid,headers\n1,2');

      req.file = { path: invalidCSV, originalname: 'invalid.csv' };

      await validateCSVFileMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Upload failed' })
      );
      expect(next).not.toHaveBeenCalled();

      if (fs.existsSync(invalidCSV)) fs.unlinkSync(invalidCSV);
    });
  });

  describe('isValidUUID', () => {
    it('returns true for valid UUID format', () => {
      expect(isValidUUID('c39a04f2-901d-407b-83ff-183709b18365')).toBe(true);
      expect(isValidUUID('A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11')).toBe(true);
    });

    it('returns false for invalid UUID strings', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('12345')).toBe(false);
      expect(isValidUUID('')).toBe(false);
      expect(isValidUUID(null)).toBe(false);
    });
  });
});
