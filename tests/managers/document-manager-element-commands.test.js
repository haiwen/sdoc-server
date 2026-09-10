jest.mock('../../src/modules/sdoc/dao/operation-log', () => ({
  listPendingOperationsByDoc: jest.fn(),
  recordOperations: jest.fn(),
  queryOperationCount: jest.fn(),
}));

jest.mock('../../src/modules/sdoc/api/sea-server-api', () => ({
  getDocContent: jest.fn(),
  saveDocContent: jest.fn(),
}));

import Document from '../../src/modules/sdoc/models/document';
import DocumentManager from '../../src/modules/sdoc/managers/document-manager';
import OperationsManager from '../../src/modules/sdoc/managers/operations-manager';
import seaServerAPI from '../../src/modules/sdoc/api/sea-server-api';
import { listPendingOperationsByDoc, recordOperations } from '../../src/modules/sdoc/dao/operation-log';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
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
    documentManager.documentLoadPromises.clear();
    OperationsManager.getInstance().operationListMap.clear();
    listPendingOperationsByDoc.mockReset();
    listPendingOperationsByDoc.mockResolvedValue([]);
    recordOperations.mockReset();
    seaServerAPI.getDocContent.mockReset();
    seaServerAPI.saveDocContent.mockReset();
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

  it('returns Socket success immediately and preserves in-memory version order while persistence is pending', async () => {
    const write = deferred();
    recordOperations.mockReturnValue(write.promise);

    const resultPromise = documentManager.execOperationsBySocket({
      doc_uuid: 'doc-1',
      version: 4,
      operations: [{ type: 'insert_text', path: [0, 0], offset: 6, text: '!' }],
      user: { username: 'writer@example.com' },
    }, 'test.sdoc');

    await expect(resultPromise).resolves.toEqual({ success: true, version: 5 });
    expect(recordOperations).toHaveBeenCalledTimes(1);
    await expect(applyCommands(documentManager, [replaceCommand('after')])).resolves.toMatchObject({ version: 6 });
    expect(OperationsManager.getInstance().operationListMap.get('doc-1').map(item => item.version)).toEqual([5, 6]);

    write.resolve();
  });

  it('keeps Socket success and the in-memory operation when background persistence fails', async () => {
    const write = deferred();
    recordOperations.mockReturnValue(write.promise);

    const result = await documentManager.execOperationsBySocket({
      doc_uuid: 'doc-1',
      version: 4,
      operations: [{ type: 'insert_text', path: [0, 0], offset: 6, text: '!' }],
      user: { username: 'writer@example.com' },
    }, 'test.sdoc');

    expect(result).toEqual({ success: true, version: 5 });
    expect(documentManager.documents.get('doc-1').elements[0].children[0].text).toBe('before!');
    expect(OperationsManager.getInstance().operationListMap.get('doc-1').map(item => item.version)).toEqual([5]);

    write.reject(new Error('database unavailable'));
    await Promise.resolve();
  });

  it('uses the loaded document instance for a cold Socket update', async () => {
    documentManager.documents.clear();
    recordOperations.mockResolvedValue();
    seaServerAPI.getDocContent.mockResolvedValue({
      data: {
        version: 4,
        format_version: 4,
        last_modify_user: '',
        elements: [{ id: 'p1', type: 'paragraph', children: [{ id: 't1', text: 'before' }] }],
      },
    });

    const result = await documentManager.execOperationsBySocket({
      doc_uuid: 'doc-1',
      version: 4,
      operations: [{ type: 'insert_text', path: [0, 0], offset: 6, text: '!' }],
      user: { username: 'writer@example.com' },
    }, 'test.sdoc');

    expect(result).toEqual({ success: true, version: 5 });
    expect(documentManager.documents.get('doc-1').elements[0].children[0].text).toBe('before!');
    expect(recordOperations).toHaveBeenCalledWith('doc-1', expect.any(Array), 5, { username: 'writer@example.com' });
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

  it('shares a cold load and applies concurrent commands to the current document instance', async () => {
    documentManager.documents.clear();
    recordOperations.mockResolvedValue();
    const load = deferred();
    seaServerAPI.getDocContent.mockReturnValue(load.promise);

    const first = applyCommands(documentManager, [replaceCommand('first')]);
    const second = applyCommands(documentManager, [replaceCommand('second')]);

    expect(seaServerAPI.getDocContent).toHaveBeenCalledTimes(1);
    load.resolve({
      data: {
        version: 4,
        format_version: 4,
        last_modify_user: '',
        elements: [{ id: 'p1', type: 'paragraph', children: [{ id: 't1', text: 'before' }] }],
      },
    });

    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ version: 5 }),
      expect.objectContaining({ version: 6 }),
    ]);

    const document = documentManager.documents.get('doc-1');
    expect(document.version).toBe(6);
    expect(document.elements[0].children[0].text).toBe('second');
    expect(recordOperations).toHaveBeenNthCalledWith(1, 'doc-1', expect.any(Array), 5, { username: 'writer@example.com' });
    expect(recordOperations).toHaveBeenNthCalledWith(2, 'doc-1', expect.any(Array), 6, { username: 'writer@example.com' });
  });

  it('maps an upstream 404 during cold load to document_not_found', async () => {
    documentManager.documents.clear();
    seaServerAPI.getDocContent.mockRejectedValue({
      message: 'Request failed with status code 404',
      response: { status: 404 },
    });

    await expect(applyCommands(documentManager, [replaceCommand('after')])).rejects.toMatchObject({
      error_code: 'document_not_found',
    });
    expect(recordOperations).not.toHaveBeenCalled();
  });

  it('does not commit a rejected text-leaf deletion', async () => {
    const document = documentManager.documents.get('doc-1');
    const originalElements = JSON.parse(JSON.stringify(document.elements));

    await expect(applyCommands(documentManager, [{
      kind: 'delete_element', target_element_id: 't1',
    }])).rejects.toMatchObject({ error_code: 'unsupported_element_type', command_index: 0 });

    expect(document.version).toBe(4);
    expect(document.elements).toEqual(originalElements);
    expect(document.getMeta().need_save).toBe(false);
    expect(recordOperations).not.toHaveBeenCalled();
    expect(OperationsManager.getInstance().operationListMap.has('doc-1')).toBe(false);
  });

  it.each([
    ['a paragraph directly under multi-column', {
      id: 'multi-column', type: 'multi_column', children: [{ id: 'invalid', type: 'paragraph', children: [{ id: 'invalid-text', text: 'invalid' }] }],
    }],
    ['a root-level column', {
      id: 'column', type: 'column', children: [{ id: 'column-paragraph', type: 'paragraph', children: [{ id: 'column-text', text: 'column' }] }],
    }],
  ])('does not commit a document with %s', async (description, invalidElement) => {
    const document = documentManager.documents.get('doc-1');
    document.elements.push(invalidElement);
    const originalElements = JSON.parse(JSON.stringify(document.elements));

    await expect(applyCommands(documentManager, [replaceCommand('after')])).rejects.toMatchObject({
      error_code: 'apply_failed',
    });

    expect(document.version).toBe(4);
    expect(document.elements).toEqual(originalElements);
    expect(document.getMeta().need_save).toBe(false);
    expect(recordOperations).not.toHaveBeenCalled();
    expect(OperationsManager.getInstance().operationListMap.has('doc-1')).toBe(false);
  });
});
