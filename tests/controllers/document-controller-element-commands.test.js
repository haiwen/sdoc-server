jest.mock('../../src/modules/sdoc/managers/document-manager', () => ({
  getInstance: jest.fn(),
}));

jest.mock('../../src/modules/sdoc/managers/element-command-manager', () => jest.fn());

jest.mock('../../src/modules/sdoc/wio/io-helper', () => ({
  hasInstance: jest.fn(),
  getInstance: jest.fn(),
}));

import documentController from '../../src/modules/sdoc/controllers/document-controller';
import DocumentManager from '../../src/modules/sdoc/managers/document-manager';
import ElementCommandManager from '../../src/modules/sdoc/managers/element-command-manager';
import IOHelper from '../../src/modules/sdoc/wio/io-helper';

const makeResponse = () => {
  const response = { status: jest.fn(), send: jest.fn() };
  response.status.mockReturnValue(response);
  return response;
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
      document_version: null,
    });
  });

  it('commits commands then broadcasts the existing update-document payload', async () => {
    const document = { version: 4 };
    const commitElementCommands = jest.fn().mockResolvedValue({ version: 5 });
    const documentManager = {
      getDoc: jest.fn().mockResolvedValue(),
      getDocument: jest.fn(() => document),
      commitElementCommands,
    };
    const plan = {
      baseDocumentVersion: 4,
      operations: [{ type: 'insert_node' }],
      elements: [{ id: 'p1' }],
      commandResults: [{ command_index: 0, target_element_id: 'p1' }],
      elementIdMappings: { paragraph: 'p1' },
    };
    const prepare = jest.fn(() => plan);
    const sendDocumentUpdate = jest.fn();
    DocumentManager.getInstance.mockReturnValue(documentManager);
    ElementCommandManager.mockImplementation(() => ({ prepare }));
    IOHelper.hasInstance.mockReturnValue(true);
    IOHelper.getInstance.mockReturnValue({ sendDocumentUpdate });
    const response = makeResponse();

    await documentController.applyElementCommands({
      params: { doc_uuid: 'doc-1' },
      payload: { file_uuid: 'doc-1', permission: 'rw', username: 'writer@example.com', filename: 'test.sdoc' },
      body: { base_document_version: 4, commands: [{ kind: 'insert_element' }] },
    }, response);

    expect(commitElementCommands).toHaveBeenCalledWith('doc-1', 4, plan.operations, plan.elements, { username: 'writer@example.com' });
    expect(sendDocumentUpdate).toHaveBeenCalledWith('doc-1', {
      operations: plan.operations,
      version: 5,
      user: { username: 'writer@example.com' },
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.send).toHaveBeenCalledWith({
      document_version: 5,
      command_results: plan.commandResults,
      element_id_mappings: plan.elementIdMappings,
    });
  });

  it('does not commit or broadcast an empty command batch', async () => {
    const document = { version: 4, elements: [{ id: 'p1' }], getMeta: () => ({ need_save: false }) };
    const commitElementCommands = jest.fn();
    const documentManager = {
      getDoc: jest.fn().mockResolvedValue(),
      getDocument: jest.fn(() => document),
      commitElementCommands,
    };
    const prepare = jest.fn(() => {
      throw { error_code: 'invalid_request', command_index: null };
    });
    const sendDocumentUpdate = jest.fn();
    DocumentManager.getInstance.mockReturnValue(documentManager);
    ElementCommandManager.mockImplementation(() => ({ prepare }));
    IOHelper.hasInstance.mockReturnValue(true);
    IOHelper.getInstance.mockReturnValue({ sendDocumentUpdate });
    const response = makeResponse();

    await documentController.applyElementCommands({
      params: { doc_uuid: 'doc-1' },
      payload: { file_uuid: 'doc-1', permission: 'rw', username: 'writer@example.com', filename: 'test.sdoc' },
      body: { base_document_version: 4, commands: [] },
    }, response);

    expect(commitElementCommands).not.toHaveBeenCalled();
    expect(sendDocumentUpdate).not.toHaveBeenCalled();
    expect(document.version).toBe(4);
    expect(document.getMeta().need_save).toBe(false);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.send).toHaveBeenCalledWith({
      error_code: 'invalid_request',
      command_index: null,
      document_version: 4,
    });
  });
});
