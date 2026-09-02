jest.mock('../../src/modules/sdoc/dao/operation-log', () => ({
  listPendingOperationsByDoc: jest.fn(),
  recordOperations: jest.fn(),
  queryOperationCount: jest.fn(),
}));

jest.mock('../../src/modules/sdoc/api/sea-server-api', () => ({
  saveDocContent: jest.fn(),
  getDocContent: jest.fn(),
}));

import Document from '../../src/modules/sdoc/models/document';
import deepCopy from 'deep-copy';
import DocumentManager from '../../src/modules/sdoc/managers/document-manager';
import OperationsManager from '../../src/modules/sdoc/managers/operations-manager';
import UsersManager from '../../src/modules/sdoc/managers/users-manager';
import { listPendingOperationsByDoc, recordOperations } from '../../src/modules/sdoc/dao/operation-log';
import seaServerAPI from '../../src/modules/sdoc/api/sea-server-api';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const flushPromises = () => new Promise(resolve => setImmediate(resolve));

const makeDocument = () => new Document('doc-1', 'test.sdoc', {
  version: 4,
  format_version: 4,
  last_modify_user: '',
  elements: [{ id: 'p1', type: 'paragraph', children: [{ id: 't1', text: 'before' }] }],
});

const commitElements = (documentManager, elements, user = { username: 'writer@example.com' }) => {
  const document = documentManager.getDocument('doc-1');
  return documentManager.commitElementCommands('doc-1', document.version, [], elements, user, document, document.elements);
};

describe('DocumentManager element command commits', () => {
  let documentManager;

  beforeEach(() => {
    documentManager = DocumentManager.getInstance();
    documentManager.documents.clear();
    documentManager.documentWriteQueues.clear();
    OperationsManager.getInstance().operationListMap.clear();
    UsersManager.getInstance().users.clear();
    recordOperations.mockReset();
    listPendingOperationsByDoc.mockReset();
    listPendingOperationsByDoc.mockResolvedValue([]);
    seaServerAPI.saveDocContent.mockReset();
    seaServerAPI.getDocContent.mockReset();
    documentManager.documents.set('doc-1', makeDocument());
  });

  it('records operations before updating the collaboration document and save state', async () => {
    const elements = [{ id: 'p1', type: 'paragraph', children: [{ id: 't2', text: 'after' }] }];
    recordOperations.mockImplementation(() => {
      const document = documentManager.getDocument('doc-1');
      expect(document.version).toBe(4);
      expect(document.elements[0].children[0].text).toBe('before');
      expect(document.getMeta().need_save).toBe(false);
      return Promise.resolve();
    });

    const expectedDocument = documentManager.getDocument('doc-1');
    const result = await documentManager.commitElementCommands('doc-1', 4, [{ type: 'remove_node', path: [0, 0], node: { id: 't1', text: 'before' } }], elements, { username: 'writer@example.com' }, expectedDocument, expectedDocument.elements);

    const document = documentManager.getDocument('doc-1');
    expect(result.version).toBe(5);
    expect(document.version).toBe(5);
    expect(document.elements).toEqual(elements);
    expect(document.last_modify_user).toBe('writer@example.com');
    expect(document.getMeta().need_save).toBe(true);
    expect(recordOperations).toHaveBeenCalledWith('doc-1', expect.any(Array), 5, { username: 'writer@example.com' });
  });

  it('keeps the document and operation cache unchanged when operation log recording fails', async () => {
    recordOperations.mockRejectedValue(new Error('database unavailable'));
    const elements = [{ id: 'p1', type: 'paragraph', children: [{ id: 't2', text: 'after' }] }];

    await expect(commitElements(documentManager, elements)).rejects.toMatchObject({ error_code: 'apply_failed' });

    const document = documentManager.getDocument('doc-1');
    expect(document.version).toBe(4);
    expect(document.elements[0].children[0].text).toBe('before');
    expect(document.last_modify_user).toBe('');
    expect(document.getMeta().need_save).toBe(false);
    expect(OperationsManager.getInstance().operationListMap.has('doc-1')).toBe(false);
  });

  it('allows a failed element command request to retry with its original version', async () => {
    const elements = [{ id: 'p1', type: 'paragraph', children: [{ id: 't2', text: 'after' }] }];
    recordOperations.mockRejectedValueOnce(new Error('database unavailable')).mockResolvedValueOnce();

    await expect(commitElements(documentManager, elements)).rejects.toMatchObject({ error_code: 'apply_failed' });
    await expect(commitElements(documentManager, elements)).resolves.toEqual({ version: 5 });

    expect(documentManager.getDocument('doc-1').version).toBe(5);
    expect(recordOperations).toHaveBeenNthCalledWith(2, 'doc-1', [], 5, { username: 'writer@example.com' });
  });

  it('rejects a stale version without modifying the document', async () => {
    recordOperations.mockResolvedValue();
    const document = documentManager.getDocument('doc-1');

    await expect(documentManager.commitElementCommands('doc-1', 3, [], [], { username: 'writer@example.com' }, document, document.elements)).rejects.toMatchObject({ error_code: 'document_version_conflict' });

    expect(document.version).toBe(4);
    expect(document.elements[0].children[0].text).toBe('before');
    expect(recordOperations).not.toHaveBeenCalled();
  });

  it('serializes an element command and socket update for the same document', async () => {
    const write = deferred();
    recordOperations.mockImplementation(() => write.promise);
    const elements = [{ id: 'p1', type: 'paragraph', children: [{ id: 't2', text: 'element' }] }];
    const document = documentManager.getDocument('doc-1');
    const elementCommit = documentManager.commitElementCommands('doc-1', 4, [{ type: 'insert_node' }], elements, { username: 'element@example.com' }, document, document.elements);
    const socketCommit = documentManager.execOperationsBySocket({
      doc_uuid: 'doc-1',
      version: 4,
      operations: [{ type: 'insert_text', path: [0, 0], offset: 6, text: ' socket' }],
      user: { username: 'socket@example.com' },
    }, 'test.sdoc');

    await flushPromises();
    expect(recordOperations).toHaveBeenCalledTimes(1);
    write.resolve();

    await expect(elementCommit).resolves.toEqual({ version: 5 });
    await expect(socketCommit).resolves.toMatchObject({ success: false, error_type: 'version_behind_server' });
    expect(recordOperations).toHaveBeenCalledTimes(1);
    expect(documentManager.getDocument('doc-1').version).toBe(5);
  });

  it('allows writes for different documents to persist in parallel', async () => {
    const firstWrite = deferred();
    const secondWrite = deferred();
    documentManager.documents.set('doc-2', new Document('doc-2', 'second.sdoc', {
      version: 4,
      format_version: 4,
      last_modify_user: '',
      elements: [{ id: 'p2', type: 'paragraph', children: [{ id: 't2', text: 'before' }] }],
    }));
    recordOperations.mockImplementation(docUuid => docUuid === 'doc-1' ? firstWrite.promise : secondWrite.promise);

    const firstDocument = documentManager.getDocument('doc-1');
    const secondDocument = documentManager.getDocument('doc-2');
    const first = documentManager.commitElementCommands('doc-1', 4, [], [{ id: 'p1', type: 'paragraph', children: [{ id: 't1-new', text: 'first' }] }], { username: 'first@example.com' }, firstDocument, firstDocument.elements);
    const second = documentManager.commitElementCommands('doc-2', 4, [], [{ id: 'p2', type: 'paragraph', children: [{ id: 't2-new', text: 'second' }] }], { username: 'second@example.com' }, secondDocument, secondDocument.elements);

    await flushPromises();
    expect(recordOperations).toHaveBeenCalledTimes(2);
    secondWrite.resolve();
    firstWrite.resolve();
    await expect(Promise.all([first, second])).resolves.toEqual([{ version: 5 }, { version: 5 }]);
  });

  it('continues a document write queue after a failed task', async () => {
    recordOperations.mockRejectedValueOnce(new Error('database unavailable')).mockResolvedValueOnce();
    const elements = [{ id: 'p1', type: 'paragraph', children: [{ id: 't2', text: 'after' }] }];

    const document = documentManager.getDocument('doc-1');
    const failed = documentManager.commitElementCommands('doc-1', 4, [], elements, { username: 'first@example.com' }, document, document.elements);
    const succeeded = documentManager.commitElementCommands('doc-1', 4, [], elements, { username: 'second@example.com' }, document, document.elements);

    await expect(failed).rejects.toMatchObject({ error_code: 'apply_failed' });
    await expect(succeeded).resolves.toEqual({ version: 5 });
    expect(documentManager.getDocument('doc-1').last_modify_user).toBe('second@example.com');
  });

  it('keeps socket document state unchanged when operation log recording fails', async () => {
    recordOperations.mockRejectedValue(new Error('database unavailable'));

    const result = await documentManager.execOperationsBySocket({
      doc_uuid: 'doc-1',
      version: 4,
      operations: [{ type: 'insert_text', path: [0, 0], offset: 6, text: ' socket' }],
      user: { username: 'socket@example.com' },
    }, 'test.sdoc');

    expect(result).toEqual({ success: false, error_type: 'save_operations_to_database_error' });
    expect(documentManager.getDocument('doc-1').version).toBe(4);
    expect(documentManager.getDocument('doc-1').elements[0].children[0].text).toBe('before');
    expect(OperationsManager.getInstance().operationListMap.has('doc-1')).toBe(false);
  });

  it('keeps new save work pending when the document changes during a save', async () => {
    const save = deferred();
    seaServerAPI.saveDocContent.mockReturnValue(save.promise);
    const document = documentManager.getDocument('doc-1');
    document.setMeta({need_save: true});

    const saving = documentManager.saveDoc('doc-1');
    document.setValue([{ id: 'p1', type: 'paragraph', children: [{ id: 't2', text: 'after' }] }], 5);
    save.resolve();
    await expect(saving).resolves.toBe(true);

    expect(document.getMeta()).toMatchObject({ is_saving: false, need_save: true });
  });

  it('clears save work only after the saved version succeeds', async () => {
    seaServerAPI.saveDocContent.mockResolvedValue();
    const document = documentManager.getDocument('doc-1');
    document.setMeta({need_save: true});

    await expect(documentManager.saveDoc('doc-1')).resolves.toBe(true);

    expect(document.getMeta()).toMatchObject({ is_saving: false, need_save: false });
  });

  it('keeps save work pending and clears is_saving after a non-404 save failure', async () => {
    seaServerAPI.saveDocContent.mockRejectedValue({ response: { status: 500 } });
    const document = documentManager.getDocument('doc-1');
    document.setMeta({need_save: true});

    await expect(documentManager.saveDoc('doc-1')).resolves.toBe(false);

    expect(document.getMeta()).toMatchObject({ is_saving: false, need_save: true });
  });

  it('removes a document after a 404 save failure without restoring it', async () => {
    seaServerAPI.saveDocContent.mockRejectedValue({ response: { status: 404 } });
    documentManager.getDocument('doc-1').setMeta({need_save: true});

    await expect(documentManager.saveDoc('doc-1')).resolves.toBe(false);

    expect(documentManager.getDocument('doc-1')).toBeUndefined();
  });

  it('rejects a plan when its document instance was replaced with the same version', async () => {
    const expectedDocument = documentManager.getDocument('doc-1');
    const expectedElements = expectedDocument.elements;
    const replacement = makeDocument();
    documentManager.documents.set('doc-1', replacement);

    await expect(documentManager.commitElementCommands('doc-1', 4, [], [], { username: 'writer@example.com' }, expectedDocument, expectedElements)).rejects.toMatchObject({ error_code: 'document_version_conflict' });

    expect(recordOperations).not.toHaveBeenCalled();
    expect(replacement.version).toBe(4);
    expect(replacement.elements[0].children[0].text).toBe('before');
    expect(replacement.last_modify_user).toBe('');
    expect(replacement.getMeta().need_save).toBe(false);
  });

  it('rejects a plan when normalize replaces elements without changing its version', async () => {
    const document = documentManager.getDocument('doc-1');
    const expectedElements = document.elements;
    document.elements = deepCopy(document.elements);

    await expect(documentManager.commitElementCommands('doc-1', 4, [], [], { username: 'writer@example.com' }, document, expectedElements)).rejects.toMatchObject({ error_code: 'document_version_conflict' });

    expect(recordOperations).not.toHaveBeenCalled();
    expect(document.version).toBe(4);
    expect(document.last_modify_user).toBe('');
    expect(document.getMeta().need_save).toBe(false);
  });

  it('does not remove a document while an element commit persists its operation log', async () => {
    const write = deferred();
    recordOperations.mockReturnValue(write.promise);
    const document = documentManager.getDocument('doc-1');
    const commit = documentManager.commitElementCommands('doc-1', 4, [], [{ id: 'p1', type: 'paragraph', children: [{ id: 't2', text: 'after' }] }], { username: 'writer@example.com' }, document, document.elements);
    const remove = documentManager.removeDoc('doc-1');

    await flushPromises();
    expect(documentManager.getDocument('doc-1')).toBe(document);
    write.resolve();
    await expect(commit).resolves.toEqual({ version: 5 });
    await remove;
    expect(documentManager.getDocument('doc-1')).toBeUndefined();
  });

  it('does not reload a document while an element commit persists its operation log', async () => {
    const write = deferred();
    recordOperations.mockReturnValue(write.promise);
    seaServerAPI.getDocContent.mockResolvedValue({ data: {
      version: 4,
      format_version: 4,
      last_modify_user: 'reload@example.com',
      elements: [{ id: 'reloaded', type: 'paragraph', children: [{ id: 'reloaded-text', text: 'reloaded' }] }],
    } });
    const document = documentManager.getDocument('doc-1');
    const commit = documentManager.commitElementCommands('doc-1', 4, [], [{ id: 'p1', type: 'paragraph', children: [{ id: 't2', text: 'after' }] }], { username: 'writer@example.com' }, document, document.elements);
    const reload = documentManager.reloadDoc('doc-1', 'test.sdoc');

    await flushPromises();
    expect(documentManager.getDocument('doc-1')).toBe(document);
    write.resolve();
    await expect(commit).resolves.toEqual({ version: 5 });
    await reload;
    expect(documentManager.getDocument('doc-1').elements[0].id).toBe('reloaded');
  });

  it('rejects an old plan after removal completes first', async () => {
    const expectedDocument = documentManager.getDocument('doc-1');
    const expectedElements = expectedDocument.elements;

    await documentManager.removeDoc('doc-1');
    await expect(documentManager.commitElementCommands('doc-1', 4, [], [], { username: 'writer@example.com' }, expectedDocument, expectedElements)).rejects.toMatchObject({ error_code: 'document_version_conflict' });

    expect(recordOperations).not.toHaveBeenCalled();
  });

  it('rejects an old plan after a queued reload completes first', async () => {
    const expectedDocument = documentManager.getDocument('doc-1');
    const expectedElements = expectedDocument.elements;
    seaServerAPI.getDocContent.mockResolvedValue({ data: {
      version: 4,
      format_version: 4,
      last_modify_user: 'reload@example.com',
      elements: [{ id: 'reloaded', type: 'paragraph', children: [{ id: 'reloaded-text', text: 'reloaded' }] }],
    } });

    await documentManager.reloadDoc('doc-1', 'test.sdoc');
    await expect(documentManager.commitElementCommands('doc-1', 4, [], [], { username: 'writer@example.com' }, expectedDocument, expectedElements)).rejects.toMatchObject({ error_code: 'document_version_conflict' });
    expect(recordOperations).not.toHaveBeenCalled();
  });

  it('shares one cold load between concurrent requests', async () => {
    documentManager.documents.clear();
    const load = deferred();
    seaServerAPI.getDocContent.mockReturnValue(load.promise);

    const first = documentManager.getDoc('doc-1', 'test.sdoc');
    const second = documentManager.getDoc('doc-1', 'test.sdoc');
    await flushPromises();
    expect(seaServerAPI.getDocContent).toHaveBeenCalledTimes(1);
    load.resolve({ data: {
      version: 4,
      format_version: 4,
      last_modify_user: '',
      elements: [{ id: 'p1', type: 'paragraph', children: [{ id: 't1', text: 'loaded' }] }],
    } });

    const [firstContent, secondContent] = await Promise.all([first, second]);
    expect(firstContent.elements).toBe(secondContent.elements);
    expect(documentManager.getDocument('doc-1').elements).toBe(firstContent.elements);
  });

  it('saves a first empty document after leaving the cold-load queue', async () => {
    documentManager.documents.clear();
    seaServerAPI.getDocContent.mockResolvedValue({ data: null });
    seaServerAPI.saveDocContent.mockRejectedValue({ response: { status: 404 } });

    await expect(documentManager.getDoc('doc-1', 'test.sdoc', 'Test.sdoc', 'writer@example.com')).resolves.toMatchObject({ version: 0 });
    expect(documentManager.getDocument('doc-1')).toBeUndefined();
  });

  it('skips queued eviction when document access is refreshed', async () => {
    const blocker = deferred();
    documentManager.getDocument('doc-1').setMeta({ last_access: 0 });
    const blockingWrite = documentManager.enqueueDocumentWrite('doc-1', () => blocker.promise);
    const eviction = documentManager.removeDocsWithNoAccess(['doc-1']);

    documentManager.getDocument('doc-1').setMeta({ last_access: Date.now() });
    blocker.resolve();
    await Promise.all([blockingWrite, eviction]);

    expect(documentManager.getDocument('doc-1')).toBeDefined();
    expect(OperationsManager.getInstance().operationListMap.has('doc-1')).toBe(false);
  });

  it('skips queued eviction when a user rejoins', async () => {
    const blocker = deferred();
    documentManager.getDocument('doc-1').setMeta({ last_access: 0 });
    const blockingWrite = documentManager.enqueueDocumentWrite('doc-1', () => blocker.promise);
    const eviction = documentManager.removeDocsWithNoAccess(['doc-1']);

    UsersManager.getInstance().addUser('doc-1', 'socket-1', { username: 'writer@example.com' });
    blocker.resolve();
    await Promise.all([blockingWrite, eviction]);

    expect(documentManager.getDocument('doc-1')).toBeDefined();
  });

  it('skips queued eviction when the document instance changes', async () => {
    const blocker = deferred();
    documentManager.getDocument('doc-1').setMeta({ last_access: 0 });
    const blockingWrite = documentManager.enqueueDocumentWrite('doc-1', () => blocker.promise);
    const eviction = documentManager.removeDocsWithNoAccess(['doc-1']);
    const replacement = makeDocument();
    documentManager.documents.set('doc-1', replacement);

    blocker.resolve();
    await Promise.all([blockingWrite, eviction]);

    expect(documentManager.getDocument('doc-1')).toBe(replacement);
  });

  it('removes an unchanged inactive document from memory and operation cache', async () => {
    const document = documentManager.getDocument('doc-1');
    document.setMeta({ last_access: 0 });
    OperationsManager.getInstance().operationListMap.set('doc-1', [{ operations: [], version: 4 }]);

    await documentManager.removeDocsWithNoAccess(['doc-1']);

    expect(documentManager.getDocument('doc-1')).toBeUndefined();
    expect(OperationsManager.getInstance().operationListMap.has('doc-1')).toBe(false);
  });
});
