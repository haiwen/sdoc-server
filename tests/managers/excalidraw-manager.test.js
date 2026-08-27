import seaServerAPI from '../../src/modules/exdraw/api/sea-server-api';

jest.mock('../../src/loggers', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import ExcalidrawManager from '../../src/modules/exdraw/managers/excalidraw-manager';
import ExcalidrawDocument from '../../src/modules/exdraw/models/excalidraw-document';

const createDeferred = () => {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

describe('ExcalidrawManager scene loading', () => {
  let manager;
  let mockGetSceneContent;
  let mockSaveSceneContent;

  beforeEach(() => {
    ExcalidrawManager.instance = null;
    manager = ExcalidrawManager.getInstance();
    mockGetSceneContent = jest.spyOn(seaServerAPI, 'getSceneContent');
    mockSaveSceneContent = jest.spyOn(seaServerAPI, 'saveSceneContent');
  });

  afterEach(() => {
    mockGetSceneContent.mockRestore();
    mockSaveSceneContent.mockRestore();
  });

  it('does not overwrite a document updated while a cold load is in flight', async () => {
    const firstLoad = createDeferred();
    const secondLoad = createDeferred();
    mockGetSceneContent
      .mockReturnValueOnce(firstLoad.promise)
      .mockReturnValueOnce(secondLoad.promise);

    const firstRequest = manager.getSceneDoc('doc-1', 'scene.excalidraw', 'user-1');
    const secondRequest = manager.getSceneDoc('doc-1', 'scene.excalidraw', 'user-2');
    expect(mockGetSceneContent).toHaveBeenCalledTimes(2);

    firstLoad.resolve({
      data: {
        version: 0,
        elements: [],
      },
    });
    await firstRequest;

    const result = await manager.execOperationsBySocket({
      doc_uuid: 'doc-1',
      version: 0,
      user: { _username: 'user-1' },
      elements: [],
    }, 'scene.excalidraw');
    expect(result.success).toBe(true);
    expect(manager.documents.get('doc-1').version).toBe(1);

    secondLoad.resolve({
      data: {
        version: 0,
        elements: [],
      },
    });
    await secondRequest;

    expect(manager.documents.get('doc-1').version).toBe(1);
  });

  it('keeps the document dirty when a new edit arrives during save', async () => {
    const saveRequest = createDeferred();
    mockSaveSceneContent.mockReturnValue(saveRequest.promise);

    const document = new ExcalidrawDocument('doc-2', 'scene.excalidraw', {
      version: 0,
      elements: [],
    });
    document.setValue([], 1);
    manager.documents.set('doc-2', document);

    const savePromise = manager.saveSceneDoc('doc-2');
    document.setValue([{ id: 'new-element' }], 2);
    saveRequest.resolve({});

    expect(await savePromise).toBe(true);
    expect(document.version).toBe(2);
    expect(document.getMeta().is_saving).toBe(false);
    expect(document.getMeta().need_save).toBe(true);
  });

  it('keeps the document dirty when saving fails', async () => {
    mockSaveSceneContent.mockRejectedValue(new Error('save failed'));

    const document = new ExcalidrawDocument('doc-3', 'scene.excalidraw', {
      version: 0,
      elements: [],
    });
    document.setValue([], 1);
    manager.documents.set('doc-3', document);

    expect(await manager.saveSceneDoc('doc-3')).toBe(false);
    expect(document.getMeta().is_saving).toBe(false);
    expect(document.getMeta().need_save).toBe(true);
  });

  it('clears the dirty flag after saving the current version', async () => {
    mockSaveSceneContent.mockResolvedValue({});

    const document = new ExcalidrawDocument('doc-4', 'scene.excalidraw', {
      version: 0,
      elements: [],
    });
    document.setValue([], 1);
    manager.documents.set('doc-4', document);

    expect(await manager.saveSceneDoc('doc-4')).toBe(true);
    expect(document.getMeta().is_saving).toBe(false);
    expect(document.getMeta().need_save).toBe(false);
  });

});
