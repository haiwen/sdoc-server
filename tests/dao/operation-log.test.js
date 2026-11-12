jest.mock('../../src/db-helper', () => jest.fn());

import DBHelper from '../../src/db-helper';
import { listPendingOperationsByDoc, queryOperationCount, recordOperations } from '../../src/modules/sdoc/dao/operation-log';

describe('Operation log SQL parameters', () => {
  beforeEach(() => {
    DBHelper.mockReset();
    jest.spyOn(Date, 'now').mockReturnValue(100000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('binds document IDs and versions without inserting them into SQL', async () => {
    const docUuid = "doc' OR 1=1 --";
    const version = '0 OR 1=1';
    DBHelper.mockResolvedValue([{ op_id: 4 }]);

    await expect(listPendingOperationsByDoc(docUuid, version)).resolves.toEqual([{ op_id: 4 }]);

    const [sql, values] = DBHelper.mock.calls[0];
    expect(sql).toContain('doc_uuid=? AND op_id>? ORDER BY op_id');
    expect(sql).not.toContain(docUuid);
    expect(sql).not.toContain(version);
    expect(values).toEqual([docUuid, version]);
  });

  it.each([[1000, 99000], [-1, -1]])('binds the timestamp for interval %s', (interval, timestamp) => {
    queryOperationCount(interval);

    expect(DBHelper).toHaveBeenCalledWith(
      'SELECT count(1) AS count FROM sdoc_operation_log WHERE op_time>=?', [timestamp]
    );
  });

  it('preserves bound operation inserts', () => {
    const operations = [{ type: 'insert_text', text: "it's text" }];
    recordOperations('doc-1', operations, 4, { username: "user's@example.com" });

    expect(DBHelper).toHaveBeenCalledWith(
      expect.stringContaining('VALUES (?, ?, ?, ?, ?)'),
      ['doc-1', 4, 100000, JSON.stringify(operations), "user's@example.com"]
    );
  });
});
