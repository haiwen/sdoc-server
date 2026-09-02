jest.mock('../../src/modules/sdoc/managers/document-manager', () => ({
  getInstance: jest.fn(),
}));

jest.mock('../../src/modules/sdoc/wio/io-helper', () => ({
  hasInstance: jest.fn(),
  getInstance: jest.fn(),
}));

import documentController from '../../src/modules/sdoc/controllers/document-controller';
import DocumentManager from '../../src/modules/sdoc/managers/document-manager';
import IOHelper from '../../src/modules/sdoc/wio/io-helper';

const makeResponse = () => {
  const response = { status: jest.fn(), send: jest.fn() };
  response.status.mockReturnValue(response);
  return response;
};

const flushPromises = () => new Promise(resolve => setImmediate(resolve));

const deferred = () => {
  let resolve;
  const promise = new Promise(resolvePromise => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

describe('DocumentController element command permissions', () => {
  it.each([
    [{ file_uuid: 'other-doc', permission: 'rw', username: 'writer@example.com' }],
    [{ file_uuid: 'doc-1', permission: 'r', username: 'writer@example.com' }],
    [{ file_uuid: 'doc-1', permission: 'rw' }],
  ])('rejects an invalid write identity', async payload => {
    const response = makeResponse();

    await documentController.applyElementCommands({ params: { doc_uuid: 'doc-1' }, payload, body: {} }, response);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.send).toHaveBeenCalledWith({
      error_code: 'permission_denied',
      command_index: null,
    });
  });

  it('commits commands then broadcasts the existing update-document payload', async () => {
    const document = { version: 4 };
    const plan = {
      operations: [{ type: 'insert_node' }],
      commandResults: [{ command_index: 0, target_element_id: 'p1' }],
      elementIdMappings: { paragraph: 'p1' },
    };
    const applyElementCommands = jest.fn().mockResolvedValue({ version: 5, plan });
    const documentManager = {
      getDocument: jest.fn(() => document),
      applyElementCommands,
    };
    const sendDocumentUpdate = jest.fn();
    DocumentManager.getInstance.mockReturnValue(documentManager);
    IOHelper.hasInstance.mockReturnValue(true);
    IOHelper.getInstance.mockReturnValue({ sendDocumentUpdate });
    const response = makeResponse();

    await documentController.applyElementCommands({
      params: { doc_uuid: 'doc-1' },
      payload: { file_uuid: 'doc-1', permission: 'rw', username: 'writer@example.com', filename: 'test.sdoc' },
      body: { commands: [{ kind: 'insert_element' }] },
    }, response);

    expect(applyElementCommands).toHaveBeenCalledWith('doc-1', 'test.sdoc', undefined, 'writer@example.com', { commands: [{ kind: 'insert_element' }] });
    expect(sendDocumentUpdate).toHaveBeenCalledWith('doc-1', {
      operations: plan.operations,
      version: 5,
      user: { username: 'writer@example.com' },
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.send).toHaveBeenCalledWith({
      applied_document_version: 5,
      command_results: plan.commandResults,
      element_id_mappings: plan.elementIdMappings,
    });
  });

  it('does not commit or broadcast an empty command batch', async () => {
    const document = { version: 4, elements: [{ id: 'p1' }], getMeta: () => ({ need_save: false }) };
    const applyElementCommands = jest.fn().mockRejectedValue({ error_code: 'invalid_request', command_index: null });
    const documentManager = {
      getDocument: jest.fn(() => document),
      applyElementCommands,
    };
    const sendDocumentUpdate = jest.fn();
    DocumentManager.getInstance.mockReturnValue(documentManager);
    IOHelper.hasInstance.mockReturnValue(true);
    IOHelper.getInstance.mockReturnValue({ sendDocumentUpdate });
    const response = makeResponse();

    await documentController.applyElementCommands({
      params: { doc_uuid: 'doc-1' },
      payload: { file_uuid: 'doc-1', permission: 'rw', username: 'writer@example.com', filename: 'test.sdoc' },
      body: { commands: [] },
    }, response);

    expect(applyElementCommands).toHaveBeenCalledTimes(1);
    expect(sendDocumentUpdate).not.toHaveBeenCalled();
    expect(document.version).toBe(4);
    expect(document.getMeta().need_save).toBe(false);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.send).toHaveBeenCalledWith({
      error_code: 'invalid_request',
      command_index: null,
    });
  });

  it('does not broadcast when an element command commit fails', async () => {
    const document = { version: 4 };
    const applyElementCommands = jest.fn().mockRejectedValue({ error_code: 'apply_failed' });
    const documentManager = {
      getDocument: jest.fn(() => document),
      applyElementCommands,
    };
    const sendDocumentUpdate = jest.fn();
    DocumentManager.getInstance.mockReturnValue(documentManager);
    IOHelper.hasInstance.mockReturnValue(true);
    IOHelper.getInstance.mockReturnValue({ sendDocumentUpdate });
    const response = makeResponse();

    await documentController.applyElementCommands({
      params: { doc_uuid: 'doc-1' },
      payload: { file_uuid: 'doc-1', permission: 'rw', username: 'writer@example.com', filename: 'test.sdoc' },
      body: { commands: [{ kind: 'insert_element' }] },
    }, response);

    expect(sendDocumentUpdate).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(500);
  });

  it('returns the committed result when broadcasting the update fails', async () => {
    const document = { version: 5 };
    const plan = {
      operations: [{ type: 'insert_node' }],
      commandResults: [{ command_index: 0, target_element_id: 'p1' }],
      elementIdMappings: {},
    };
    const applyElementCommands = jest.fn().mockResolvedValue({ version: 5, plan });
    const documentManager = {
      getDocument: jest.fn(() => document),
      applyElementCommands,
    };
    const sendDocumentUpdate = jest.fn(() => {
      throw new Error('socket adapter unavailable');
    });
    DocumentManager.getInstance.mockReturnValue(documentManager);
    IOHelper.hasInstance.mockReturnValue(true);
    IOHelper.getInstance.mockReturnValue({ sendDocumentUpdate });
    const response = makeResponse();

    await documentController.applyElementCommands({
      params: { doc_uuid: 'doc-1' },
      payload: { file_uuid: 'doc-1', permission: 'rw', username: 'writer@example.com', filename: 'test.sdoc' },
      body: { commands: [{ kind: 'insert_element' }] },
    }, response);

    expect(sendDocumentUpdate).toHaveBeenCalledTimes(1);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.send).toHaveBeenCalledWith({
      applied_document_version: 5,
      command_results: plan.commandResults,
      element_id_mappings: plan.elementIdMappings,
    });
  });

  it('returns a current-state validation error without broadcasting', async () => {
    const document = { version: 4, elements: [{ id: 'p1' }] };
    const applyElementCommands = jest.fn().mockRejectedValue({ error_code: 'element_not_found', command_index: 0 });
    const documentManager = {
      getDocument: jest.fn(() => document),
      applyElementCommands,
    };
    const sendDocumentUpdate = jest.fn();
    DocumentManager.getInstance.mockReturnValue(documentManager);
    IOHelper.hasInstance.mockReturnValue(true);
    IOHelper.getInstance.mockReturnValue({ sendDocumentUpdate });
    const response = makeResponse();

    await documentController.applyElementCommands({
      params: { doc_uuid: 'doc-1' },
      payload: { file_uuid: 'doc-1', permission: 'rw', username: 'writer@example.com', filename: 'test.sdoc' },
      body: { commands: [{ kind: 'insert_element' }] },
    }, response);

    expect(sendDocumentUpdate).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.send).toHaveBeenCalledWith({
      error_code: 'element_not_found',
      command_index: 0,
    });
  });

  it('returns 404 without broadcasting when the document is no longer available', async () => {
    const applyElementCommands = jest.fn().mockRejectedValue({ error_code: 'document_not_found', command_index: null });
    const documentManager = {
      getDocument: jest.fn(() => undefined),
      applyElementCommands,
    };
    const sendDocumentUpdate = jest.fn();
    DocumentManager.getInstance.mockReturnValue(documentManager);
    IOHelper.hasInstance.mockReturnValue(true);
    IOHelper.getInstance.mockReturnValue({ sendDocumentUpdate });
    const response = makeResponse();

    await documentController.applyElementCommands({
      params: { doc_uuid: 'doc-1' },
      payload: { file_uuid: 'doc-1', permission: 'rw', username: 'writer@example.com', filename: 'test.sdoc' },
      body: { commands: [{ kind: 'insert_element' }] },
    }, response);

    expect(sendDocumentUpdate).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.send).toHaveBeenCalledWith({
      error_code: 'document_not_found',
      command_index: null,
    });
  });

  it('waits for publish removal before broadcasting the published message', async () => {
    const remove = deferred();
    const documentManager = {
      removeDocFromMemory: jest.fn(() => remove.promise),
      isDocInMemory: jest.fn(() => false),
    };
    const sendMessageToAllInRoom = jest.fn();
    DocumentManager.getInstance.mockReturnValue(documentManager);
    IOHelper.getInstance.mockReturnValue({ sendMessageToAllInRoom });
    const response = makeResponse();

    const publishing = documentController.publishDoc({
      params: { doc_uuid: 'doc-1' },
      body: { origin_doc_uuid: 'origin-doc', origin_doc_name: 'origin.sdoc' },
    }, response);

    await flushPromises();
    expect(sendMessageToAllInRoom).not.toHaveBeenCalled();
    expect(response.send).not.toHaveBeenCalled();
    remove.resolve(true);
    await publishing;

    expect(sendMessageToAllInRoom).toHaveBeenCalledTimes(1);
    expect(sendMessageToAllInRoom).toHaveBeenCalledWith('doc-1', 'doc-published');
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.send).toHaveBeenCalledWith({ success: true });
  });
});
