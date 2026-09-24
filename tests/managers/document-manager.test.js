jest.mock('../../src/modules/sdoc/utils/slate-utils', () => ({
  ...jest.requireActual('../../src/modules/sdoc/utils/slate-utils'),
  applyOperations: jest.fn((document) => {
    document.version += 1;
    return true;
  }),
}));
jest.mock('../../src/modules/sdoc/managers/operations-manager', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(),
  },
}));

import DocumentManager from '../../src/modules/sdoc/managers/document-manager';
import Document from '../../src/modules/sdoc/models/document';
import OperationsManager from '../../src/modules/sdoc/managers/operations-manager';

describe('DocumentManager operation handling', () => {
  let documentManager;
  let addOperations;

  beforeEach(() => {
    documentManager = new DocumentManager();
    addOperations = jest.fn(() => new Promise(() => {}));
    OperationsManager.getInstance.mockReturnValue({addOperations});
  });

  it('returns success and keeps the advanced document state while persistence runs asynchronously', async () => {
    const document = new Document('doc-1', 'test.sdoc', {
      version: 7,
      children: [{type: 'paragraph', children: [{text: ''}]}],
    });
    documentManager.documents.set('doc-1', document);

    const result = await documentManager.execOperationsBySocket({
      doc_uuid: 'doc-1',
      version: 7,
      operations: [{type: 'insert_text', text: 'hello'}],
      user: {username: 'alice'},
    }, 'test.sdoc');

    expect(result).toEqual({
      success: true,
      version: 8,
    });
    expect(document.version).toBe(8);
    expect(addOperations).toHaveBeenCalledWith(
      'doc-1',
      [{type: 'insert_text', text: 'hello'}],
      8,
      {username: 'alice'},
    );
  });
});
