jest.mock('../../src/modules/sdoc/dao/operation-log', () => ({
  listPendingOperationsByDoc: jest.fn(),
  recordOperations: jest.fn(),
  queryOperationCount: jest.fn(),
}));

import Document from '../../src/modules/sdoc/models/document';
import DocumentManager from '../../src/modules/sdoc/managers/document-manager';
import OperationsManager from '../../src/modules/sdoc/managers/operations-manager';
import { recordOperations } from '../../src/modules/sdoc/dao/operation-log';

const deferred = () => {
  let resolve;
  const promise = new Promise(resolvePromise => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const makeDocument = () => new Document('doc-1', 'test.sdoc', {
  version: 4,
  format_version: 4,
  last_modify_user: '',
  elements: [{ id: 'p1', type: 'paragraph', children: [{ id: 't1', text: 'before' }] }],
});

const replaceCommand = text => ({
  kind: 'replace_element_content',
  target_element_id: 'p1',
  payload: { text },
});

const applyCommands = (documentManager, commands) => {
  return documentManager.applyElementCommands('doc-1', 'test.sdoc', undefined, 'writer@example.com', { commands });
};

describe('DocumentManager element command commits', () => {
  let documentManager;

  beforeEach(() => {
    documentManager = DocumentManager.getInstance();
    documentManager.documents.clear();
    OperationsManager.getInstance().operationListMap.clear();
    recordOperations.mockReset();
    documentManager.documents.set('doc-1', makeDocument());
  });

  it('updates the in-memory document before recording operations', async () => {
    recordOperations.mockImplementation(() => {
      const document = documentManager.documents.get('doc-1');
      expect(document.version).toBe(5);
      expect(document.elements[0].children[0].text).toBe('after');
      expect(document.getMeta().need_save).toBe(true);
      return Promise.resolve();
    });

    const result = await applyCommands(documentManager, [replaceCommand('after')]);

    expect(result.version).toBe(5);
    expect(recordOperations).toHaveBeenCalledWith('doc-1', expect.any(Array), 5, { username: 'writer@example.com' });
  });

  it('returns before operation log persistence completes', async () => {
    const write = deferred();
    recordOperations.mockReturnValue(write.promise);

    const result = await applyCommands(documentManager, [replaceCommand('after')]);

    expect(documentManager.documents.get('doc-1').version).toBe(5);
    expect(result).toMatchObject({ version: 5 });
    expect(recordOperations).toHaveBeenCalledTimes(1);

    write.resolve();
  });

  it('keeps the in-memory update and reports success when operation log persistence fails', async () => {
    recordOperations.mockRejectedValue(new Error('database unavailable'));

    await expect(applyCommands(documentManager, [replaceCommand('after')])).resolves.toMatchObject({ version: 5 });

    const document = documentManager.documents.get('doc-1');
    expect(document.version).toBe(5);
    expect(document.elements[0].children[0].text).toBe('after');
    expect(document.last_modify_user).toBe('writer@example.com');
    expect(document.getMeta().need_save).toBe(true);
    expect(OperationsManager.getInstance().operationListMap.has('doc-1')).toBe(true);
  });

  it('returns the Socket success result before operation log persistence completes', async () => {
    const write = deferred();
    recordOperations.mockReturnValue(write.promise);

    const result = await documentManager.execOperationsBySocket({
      doc_uuid: 'doc-1',
      version: 4,
      operations: [{ type: 'insert_text', path: [0, 0], offset: 6, text: '!' }],
      user: { username: 'writer@example.com' },
    }, 'test.sdoc');

    expect(result).toEqual({ success: true, version: 5 });
    expect(recordOperations).toHaveBeenCalledTimes(1);
    write.resolve();
  });

  it('uses the current document state without requiring a caller version', async () => {
    recordOperations.mockResolvedValue();
    const document = documentManager.documents.get('doc-1');
    document.setValue([{ id: 'p1', type: 'paragraph', children: [{ id: 't2', text: 'updated by another writer' }] }], 5);

    await expect(applyCommands(documentManager, [replaceCommand('applied to current content')])).resolves.toMatchObject({ version: 6 });

    expect(document.version).toBe(6);
    expect(document.elements[0].children[0].text).toBe('applied to current content');
    expect(recordOperations).toHaveBeenCalledWith('doc-1', expect.any(Array), 6, { username: 'writer@example.com' });
  });
});
