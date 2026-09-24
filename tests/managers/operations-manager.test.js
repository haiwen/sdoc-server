jest.mock('../../src/modules/sdoc/dao/operation-log', () => ({
  recordOperations: jest.fn(),
  listPendingOperationsByDoc: jest.fn(),
  queryOperationCount: jest.fn(),
}));

import { recordOperations } from '../../src/modules/sdoc/dao/operation-log';
import OperationsManager from '../../src/modules/sdoc/managers/operations-manager';

describe('OperationsManager asynchronous persistence', () => {
  let manager;

  beforeEach(() => {
    OperationsManager.instance = null;
    manager = OperationsManager.getInstance();
    recordOperations.mockReset();
  });

  it('updates the in-memory operation list without waiting for the database', async () => {
    let resolvePersistence;
    recordOperations.mockReturnValue(new Promise(resolve => {
      resolvePersistence = resolve;
    }));
    const operations = [{type: 'insert_text', text: 'hello'}];

    manager.addOperations('doc-1', operations, 3, {username: 'alice'});

    expect(await manager.getLoseOperationList('doc-1', 2)).toEqual([
      {operations, version: 3},
    ]);
    expect(recordOperations).toHaveBeenCalledWith(
      'doc-1',
      operations,
      3,
      {username: 'alice'},
    );

    resolvePersistence();
  });
});
