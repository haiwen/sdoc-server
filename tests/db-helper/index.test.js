jest.mock('mysql2/promise', () => ({
  createPool: jest.fn(() => ({ execute: jest.fn() })),
}));

import mysql from 'mysql2/promise';
import DBHelper from '../../src/db-helper';

describe('DBHelper prepared statements', () => {
  const pool = mysql.createPool.mock.results[0].value;

  beforeEach(() => {
    pool.execute.mockReset();
  });

  it('uses prepared statements and returns rows', async () => {
    const values = ["doc' OR 1=1 --", 4];
    const rows = [{ op_id: 5 }];
    pool.execute.mockResolvedValue([rows]);

    await expect(DBHelper('SELECT * FROM sdoc_operation_log WHERE doc_uuid=? AND op_id>?', values)).resolves.toBe(rows);
    expect(pool.execute).toHaveBeenCalledWith('SELECT * FROM sdoc_operation_log WHERE doc_uuid=? AND op_id>?', values);
  });

  it.each([
    ['connect ECONNREFUSED', 'Error connecting to Database'],
    ['Invalid SQL', 'Query data from Database error'],
  ])('preserves database error handling for %s', async (message, expected) => {
    const error = new Error(message);
    pool.execute.mockRejectedValue(error);

    await expect(DBHelper('SELECT 1', [])).rejects.toMatchObject({
      message: expected, error_type: 'database_error', originalError: error,
    });
  });
});
