jest.mock('../../src/modules/sdoc/dao/operation-log', () => ({
  listPendingOperationsByDoc: jest.fn(),
  recordOperations: jest.fn(),
  queryOperationCount: jest.fn(),
}));

import Document from '../../src/modules/sdoc/models/document';
import DocumentManager from '../../src/modules/sdoc/managers/document-manager';
import OperationsManager from '../../src/modules/sdoc/managers/operations-manager';
import { recordOperations } from '../../src/modules/sdoc/dao/operation-log';

const makeDocument = () => new Document('doc-1', 'test.sdoc', {
  version: 4,
  format_version: 4,
  last_modify_user: '',
  elements: [{ id: 'p1', type: 'paragraph', children: [{ id: 't1', text: 'before' }] }],
});

describe('DocumentManager element command commits', () => {
  let documentManager;

  beforeEach(() => {
    documentManager = DocumentManager.getInstance();
    documentManager.documents.clear();
    OperationsManager.getInstance().operationListMap.clear();
    recordOperations.mockReset();
    documentManager.documents.set('doc-1', makeDocument());
  });

  it('updates the collaboration document and save state before recording operations', async () => {
    const elements = [{ id: 'p1', type: 'paragraph', children: [{ id: 't2', text: 'after' }] }];
    recordOperations.mockImplementation(() => {
      const document = documentManager.getDocument('doc-1');
      expect(document.version).toBe(5);
      expect(document.elements).toEqual(elements);
      expect(document.getMeta().need_save).toBe(true);
      return Promise.resolve();
    });

    const result = await documentManager.commitElementCommands('doc-1', 4, [{ type: 'remove_node', path: [0, 0], node: { id: 't1', text: 'before' } }], elements, { username: 'writer@example.com' });

    const document = documentManager.getDocument('doc-1');
    expect(result.version).toBe(5);
    expect(document.version).toBe(5);
    expect(document.elements).toEqual(elements);
    expect(document.last_modify_user).toBe('writer@example.com');
    expect(document.getMeta().need_save).toBe(true);
    expect(recordOperations).toHaveBeenCalledWith('doc-1', expect.any(Array), 5, { username: 'writer@example.com' });
  });

  it('keeps the applied memory update when operation log recording fails', async () => {
    recordOperations.mockRejectedValue(new Error('database unavailable'));
    const elements = [{ id: 'p1', type: 'paragraph', children: [{ id: 't2', text: 'after' }] }];

    await expect(documentManager.commitElementCommands('doc-1', 4, [], elements, { username: 'writer@example.com' })).rejects.toMatchObject({ error_code: 'apply_failed' });

    const document = documentManager.getDocument('doc-1');
    expect(document.version).toBe(5);
    expect(document.elements).toEqual(elements);
  });

  it('rejects a stale version without modifying the document', async () => {
    recordOperations.mockResolvedValue();
    const document = documentManager.getDocument('doc-1');

    await expect(documentManager.commitElementCommands('doc-1', 3, [], [], { username: 'writer@example.com' })).rejects.toMatchObject({ error_code: 'document_version_conflict' });

    expect(document.version).toBe(4);
    expect(document.elements[0].children[0].text).toBe('before');
    expect(recordOperations).not.toHaveBeenCalled();
  });
});
