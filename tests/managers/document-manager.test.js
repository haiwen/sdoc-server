import seaServerAPI from '../../src/modules/sdoc/api/sea-server-api';
import * as operationLog from '../../src/modules/sdoc/dao/operation-log';

jest.mock('../../src/loggers', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../src/modules/sdoc/dao/operation-log', () => ({
  listPendingOperationsByDoc: jest.fn(),
}));

import DocumentManager from '../../src/modules/sdoc/managers/document-manager';

const createDeferred = () => {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

describe('DocumentManager document loading', () => {
  let manager;
  let mockGetDocContent;

  beforeEach(() => {
    DocumentManager.instance = null;
    manager = DocumentManager.getInstance();
    mockGetDocContent = jest.spyOn(seaServerAPI, 'getDocContent');
    operationLog.listPendingOperationsByDoc.mockReset();
  });

  afterEach(() => {
    mockGetDocContent.mockRestore();
  });

  it('does not overwrite a document updated while a cold load is in flight', async () => {
    const firstLoad = createDeferred();
    const secondLoad = createDeferred();
    const firstPendingOperations = createDeferred();
    const secondPendingOperations = createDeferred();

    mockGetDocContent
      .mockReturnValueOnce(firstLoad.promise)
      .mockReturnValueOnce(secondLoad.promise);
    operationLog.listPendingOperationsByDoc
      .mockReturnValueOnce(firstPendingOperations.promise)
      .mockReturnValueOnce(secondPendingOperations.promise);

    const firstRequest = manager.getDoc('doc-1', 'doc.sdoc', 'Document', 'user-1');
    const secondRequest = manager.getDoc('doc-1', 'doc.sdoc', 'Document', 'user-2');

    firstLoad.resolve({
      data: {
        version: 0,
        format_version: 4,
        elements: [],
      },
    });
    await Promise.resolve();
    expect(operationLog.listPendingOperationsByDoc).toHaveBeenCalledTimes(1);

    secondLoad.resolve({
      data: {
        version: 0,
        format_version: 4,
        elements: [],
      },
    });
    await Promise.resolve();
    expect(operationLog.listPendingOperationsByDoc).toHaveBeenCalledTimes(2);

    firstPendingOperations.resolve([]);
    await firstRequest;

    const document = manager.documents.get('doc-1');
    document.setValue(document.elements, 1);

    secondPendingOperations.resolve([]);
    await secondRequest;

    expect(manager.documents.get('doc-1')).toBe(document);
    expect(manager.documents.get('doc-1').version).toBe(1);
  });
});
