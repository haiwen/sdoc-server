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

  beforeEach(() => {
    ExcalidrawManager.instance = null;
    manager = ExcalidrawManager.getInstance();
    mockGetSceneContent = jest.spyOn(seaServerAPI, 'getSceneContent');
  });

  afterEach(() => {
    mockGetSceneContent.mockRestore();
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

});
