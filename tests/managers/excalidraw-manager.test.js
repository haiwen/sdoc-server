import ExcalidrawManager from '../../src/modules/exdraw/managers/excalidraw-manager';
import ExcalidrawDocument from '../../src/modules/exdraw/models/excalidraw-document';
import seaServerAPI from '../../src/modules/exdraw/api/sea-server-api';

jest.mock('../../src/modules/exdraw/api/sea-server-api', () => ({
  __esModule: true,
  default: {
    getSceneDownloadLink: jest.fn(),
    getSceneContent: jest.fn(),
    saveSceneContent: jest.fn(),
  },
}));

jest.mock('../../src/loggers', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('../../src/utils', () => ({
  __esModule: true,
  deleteDir: jest.fn(),
  getErrorMessage: jest.fn(() => ({})),
  errorHandle: jest.fn(),
}));

const createDeferred = () => {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

describe('ExcalidrawManager cold document loading and saving', () => {
  let manager;

  beforeEach(() => {
    manager = ExcalidrawManager.getInstance();
    manager.documents = new Map();
    jest.clearAllMocks();
    seaServerAPI.getSceneDownloadLink.mockResolvedValue({
      data: { download_link: 'https://example.test/doc' },
    });
  });

  it('uses the document already cached when concurrent cold loads finish', async () => {
    const contentLoads = [];
    seaServerAPI.getSceneContent.mockImplementation(() => {
      const deferred = createDeferred();
      contentLoads.push(deferred);
      return deferred.promise;
    });

    const firstLoad = manager.getSceneDoc('doc-uuid', 'doc.excalidraw', 'user-a');
    const secondLoad = manager.getSceneDoc('doc-uuid', 'doc.excalidraw', 'user-b');

    await new Promise(resolve => setImmediate(resolve));
    expect(contentLoads).toHaveLength(2);

    contentLoads[0].resolve({
      data: { version: 0, elements: [] },
    });
    await new Promise(resolve => setImmediate(resolve));

    contentLoads[1].resolve({
      data: { version: 0, elements: [] },
    });

    const [firstDocument, secondDocument] = await Promise.all([firstLoad, secondLoad]);
    const cachedDocument = manager.documents.get('doc-uuid');

    expect(cachedDocument.last_modify_user).toBe('user-a');
    expect(firstDocument.last_modify_user).toBe('user-a');
    expect(secondDocument.last_modify_user).toBe('user-a');
  });

  it('keeps the document dirty when an operation arrives during saving', async () => {
    const document = new ExcalidrawDocument('doc-uuid', 'doc.excalidraw', {
      version: 0,
      elements: [],
    });
    document.setMeta({ need_save: true });
    manager.documents.set('doc-uuid', document);

    const save = createDeferred();
    seaServerAPI.saveSceneContent.mockReturnValue(save.promise);

    const savePromise = manager.saveSceneDoc('doc-uuid');
    document.setValue([{ id: 'new-element' }], 1);
    save.resolve({ data: {} });

    expect(await savePromise).toBe(true);
    expect(document.getMeta()).toEqual(expect.objectContaining({
      is_saving: false,
      need_save: true,
    }));
  });
});
