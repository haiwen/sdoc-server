import SdocHandler from '../../src/modules/sdoc/wio/io-handler';
import ExdrawHandler from '../../src/modules/exdraw/wio/io-handler';
import DocumentManager from '../../src/modules/sdoc/managers/document-manager';
import OperationsManager from '../../src/modules/sdoc/managers/operations-manager';
import ExdrawManager from '../../src/modules/exdraw/managers/excalidraw-manager';
import SdocUsers from '../../src/modules/sdoc/managers/users-manager';
import ExdrawUsers from '../../src/modules/exdraw/managers/users-manager';
import SdocIO from '../../src/modules/sdoc/wio/io-helper';
import ExdrawIO from '../../src/modules/exdraw/wio/io-helper';
import sdocAPI from '../../src/modules/sdoc/api/sea-server-api';
import { authenticateSocket, dispatch, foreignUuid, ownUuid } from './helpers';

jest.mock('../../src/config/config', () => ({ SEADOC_PRIVATE_KEY: 'socket-test-private-key' }));
jest.mock('../../src/modules/sdoc/managers/document-manager', () => ({ __esModule: true, default: { getInstance: jest.fn() } }));
jest.mock('../../src/modules/sdoc/managers/operations-manager', () => ({ __esModule: true, default: { getInstance: jest.fn() } }));
jest.mock('../../src/modules/exdraw/managers/excalidraw-manager', () => ({ __esModule: true, default: { getInstance: jest.fn() } }));
jest.mock('../../src/modules/sdoc/wio/io-helper', () => ({ __esModule: true, default: { getInstance: jest.fn() } }));
jest.mock('../../src/modules/exdraw/wio/io-helper', () => ({ __esModule: true, default: { getInstance: jest.fn() } }));
jest.mock('../../src/modules/sdoc/api/sea-server-api', () => ({ __esModule: true, default: { editorStatusCallback: jest.fn() } }));

const sdocEvents = ['join-room', 'update-document', 'update-cursor', 'sync-document', 'user-updated', 'reload-image', 'server-error', 'leave-room'];
const exdrawEvents = ['join-room', 'elements-updated', 'mouse-location-updated', 'server-volatile-broadcast', 'leave-room'];
const events = [
  ...sdocEvents.map(event => [SdocHandler, event]),
  ...exdrawEvents.map(event => [ExdrawHandler, event]),
];

describe('document socket event authorization', () => {
  let sockets;
  let ioHelper;
  let documentManager;
  let operationsManager;
  let sdocHandler;
  let exdrawHandler;

  const connect = (Handler = SdocHandler, claims = {}) => {
    const socket = authenticateSocket(claims);
    sockets.push(socket);
    (Handler === SdocHandler ? sdocHandler : exdrawHandler).onConnection(socket);
    Object.values(ioHelper).forEach(mock => mock.mockClear());
    return socket;
  };

  const expectNoDocumentEffects = () => {
    Object.values(documentManager).forEach(mock => expect(mock).not.toHaveBeenCalled());
    expect(operationsManager.getLoseOperationList).not.toHaveBeenCalled();
    Object.values(ioHelper).forEach(mock => expect(mock).not.toHaveBeenCalled());
    expect(sdocAPI.editorStatusCallback).not.toHaveBeenCalled();
  };

  beforeEach(() => {
    jest.useFakeTimers();
    sockets = [];
    SdocUsers.getInstance().users.clear();
    ExdrawUsers.getInstance().users.clear();
    ioHelper = Object.fromEntries([
      'sendJoinRoomMessage', 'sendMessageToRoom', 'sendCursorMessageToRoom', 'sendUserUpdatedMessage',
      'sendReloadImageMessage', 'broadcastMessage', 'sendLeaveRoomMessage', 'sendInitRoomToPrivate',
      'sendRoomUserChangeMessage', 'sendElementsMessageToRoom', 'sendMouseMessageToRoom',
    ].map(name => [name, jest.fn()]));
    documentManager = {
      getDoc: jest.fn().mockResolvedValue({ version: 16, elements: [{ text: 'Authorized content' }] }),
      execOperationsBySocket: jest.fn().mockResolvedValue({ success: true, version: 17 }),
      setCursorLocation: jest.fn(), deleteCursor: jest.fn(),
      saveDoc: jest.fn().mockResolvedValue(true), saveSceneDoc: jest.fn().mockResolvedValue(true),
    };
    operationsManager = { getLoseOperationList: jest.fn().mockResolvedValue([{ version: 16, operations: [] }]) };
    DocumentManager.getInstance.mockReturnValue(documentManager);
    ExdrawManager.getInstance.mockReturnValue(documentManager);
    OperationsManager.getInstance.mockReturnValue(operationsManager);
    SdocIO.getInstance.mockReturnValue(ioHelper);
    ExdrawIO.getInstance.mockReturnValue(ioHelper);
    sdocAPI.editorStatusCallback.mockClear().mockResolvedValue({});
    sdocHandler = new SdocHandler();
    exdrawHandler = new ExdrawHandler();
  });

  afterEach(() => {
    sockets.forEach(socket => socket.removeAllListeners());
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it.each(events)('rejects another document before any effects: %p %s', async (Handler, event) => {
    const socket = connect(Handler);
    const callback = jest.fn();
    await dispatch(socket, event, { doc_uuid: foreignUuid, version: -1001, operations: [], elements: [] }, callback);
    expect(callback).toHaveBeenCalledWith({ success: false, error_type: 'permission_denied' });
    expect(socket.join).not.toHaveBeenCalled();
    expectNoDocumentEffects();
    expect(SdocUsers.getInstance().users.size).toBe(0);
    expect(ExdrawUsers.getInstance().users.size).toBe(0);
  });

  it.each(events)('rejects expired tokens on every event: %p %s', async (Handler, event) => {
    const socket = connect(Handler);
    jest.setSystemTime(new Date(Date.now() + 301000));
    const callback = jest.fn();
    await dispatch(socket, event, { doc_uuid: ownUuid, version: 16 }, callback);
    expect(callback).toHaveBeenCalledWith({ success: false, error_type: 'token_expired' });
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expectNoDocumentEffects();
  });

  it.each([
    [SdocHandler, 'update-document'], [SdocHandler, 'server-error'],
    [ExdrawHandler, 'elements-updated'], [ExdrawHandler, 'server-volatile-broadcast'],
  ])('rejects readonly content mutations: %p %s', async (Handler, event) => {
    const socket = connect(Handler, { permission: 'r' });
    const callback = jest.fn();
    await dispatch(socket, event, { doc_uuid: ownUuid, permission: 'rw', user: { permission: 'rw' } }, callback);
    expect(callback).toHaveBeenCalledWith({ success: false, error_type: 'permission_denied' });
    expectNoDocumentEffects();
  });

  it.each([null, 123, '', [], true])('rejects malformed payloads without throwing: %p', async params => {
    const socket = connect();
    const callback = jest.fn();
    await dispatch(socket, 'sync-document', params, callback);
    expect(callback).toHaveBeenCalledWith({ success: false, error_type: 'invalid_params' });
    expectNoDocumentEffects();
  });

  it.each(events)('validates payloads before every listener: %p %s', async (Handler, event) => {
    const socket = connect(Handler);
    const callback = jest.fn();
    await dispatch(socket, event, null, callback);
    expect(callback).toHaveBeenCalledWith({ success: false, error_type: 'invalid_params' });
    expect(socket.join).not.toHaveBeenCalled();
    expectNoDocumentEffects();
  });

  it.each([SdocHandler, ExdrawHandler])('stops unauthorized packets before any listener is called: %p', async Handler => {
    const socket = connect(Handler);
    const listener = jest.fn();
    socket.prependListener('join-room', listener);
    const callback = jest.fn();
    await dispatch(socket, 'join-room', { doc_uuid: foreignUuid }, callback);
    expect(callback).toHaveBeenCalledWith({ success: false, error_type: 'permission_denied' });
    expect(listener).not.toHaveBeenCalled();
    expectNoDocumentEffects();
  });

  it.each([
    [SdocHandler, 'update-document'], [ExdrawHandler, 'elements-updated'],
  ])('drops unauthorized packets without an acknowledgement callback: %p %s', async (Handler, event) => {
    const socket = connect(Handler);
    await dispatch(socket, event, { doc_uuid: foreignUuid });
    expect(socket.disconnected).toBe(false);
    expectNoDocumentEffects();
  });

  it.each(['unknown-event', 'constructor', '__proto__'])('requires an explicit event permission for %s', async event => {
    const socket = connect();
    const listener = jest.fn();
    socket.on(event, listener);
    const callback = jest.fn();
    await dispatch(socket, event, { doc_uuid: ownUuid }, callback);
    expect(callback).toHaveBeenCalledWith({ success: false, error_type: 'unsupported_event' });
    expect(listener).not.toHaveBeenCalled();
    expectNoDocumentEffects();
  });

  it.each([null, 123, '', [], {}])('rejects invalid legacy UUID values: %p', async doc_uuid => {
    const socket = connect();
    const callback = jest.fn();
    await dispatch(socket, 'sync-document', { doc_uuid, version: 16 }, callback);
    expect(callback).toHaveBeenCalledWith({ success: false, error_type: 'permission_denied' });
    expectNoDocumentEffects();
  });

  it.each([-1001, 15])('allows readonly sync of the authenticated document at client version %s', async version => {
    const socket = connect(SdocHandler, { permission: 'r' });
    const callback = jest.fn();
    await dispatch(socket, 'sync-document', { doc_uuid: ownUuid, version }, callback);
    expect(documentManager.getDoc).toHaveBeenCalledWith(ownUuid, 'Authorized.sdoc');
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ success: true, mode: version < 0 ? 'document' : 'operations' }));
    if (version >= 0) expect(operationsManager.getLoseOperationList).toHaveBeenCalledWith(ownUuid, version);
  });

  it('uses the authenticated UUID when the payload omits it', async () => {
    const socket = connect();
    await dispatch(socket, 'sync-document', { version: -1001 }, jest.fn());
    expect(documentManager.getDoc).toHaveBeenCalledWith(ownUuid, 'Authorized.sdoc');
  });

  it('preserves the SeaDoc join callback and registers only the authenticated user', async () => {
    const socket = connect();
    const callback = jest.fn();
    await dispatch(socket, 'join-room', callback);
    expect(callback).toHaveBeenCalledWith({ success: 1, version: 16 });
    expect(socket.join).toHaveBeenCalledWith(ownUuid);
    expect(SdocUsers.getInstance().getUser(ownUuid, socket.id)).toEqual(socket.userInfo);
  });

  it('overwrites forged author identity before an edit reaches the manager or room', async () => {
    const socket = connect();
    const operations = [{ type: 'insert_text', text: 'Authorized edit' }];
    await dispatch(socket, 'update-document', {
      doc_uuid: ownUuid, version: 16, operations,
      user: { username: 'victim@example.com', permission: 'admin' },
    }, jest.fn());
    expect(documentManager.execOperationsBySocket).toHaveBeenCalledWith(expect.objectContaining({
      doc_uuid: ownUuid, operations, user: socket.userInfo,
    }), 'Authorized.sdoc');
    expect(ioHelper.sendMessageToRoom).toHaveBeenCalledWith(socket, ownUuid, expect.objectContaining({ user: socket.userInfo }));
  });

  it('binds cursor storage and broadcasts to the authenticated identity', async () => {
    const socket = connect();
    await dispatch(socket, 'update-cursor', { user: { username: 'victim@example.com' }, location: {} });
    expect(documentManager.setCursorLocation).toHaveBeenCalledWith(expect.objectContaining({ doc_uuid: ownUuid, user: socket.userInfo }));
    expect(ioHelper.sendCursorMessageToRoom).toHaveBeenCalledWith(socket, ownUuid, expect.objectContaining({ user: socket.userInfo }));
  });

  it('allows display name changes without changing the authenticated identity or permission', async () => {
    const socket = connect();
    await dispatch(socket, 'user-updated', { user: {
      name: 'Updated name', username: 'victim@example.com', permission: 'admin', avatar_url: '/forged.png',
    } });
    expect(socket.userInfo).toEqual({
      username: 'user@example.com', permission: 'rw', name: 'Updated name', avatar_url: '/avatar.png',
    });
    expect(SdocUsers.getInstance().getUser(ownUuid, socket.id)).toEqual(socket.userInfo);
  });

  it('scopes server-error broadcasts to the authenticated document', async () => {
    const socket = connect();
    await dispatch(socket, 'server-error');
    expect(ioHelper.broadcastMessage).toHaveBeenCalledWith(ownUuid);
  });

  it('uses trusted Excalidraw identity for room membership and preserves client profile fields', async () => {
    const socket = connect(ExdrawHandler, { permission: 'r' });
    await dispatch(socket, 'join-room', { doc_uuid: ownUuid, user: { _username: 'victim@example.com' } });
    expect(socket.join).toHaveBeenCalledWith(ownUuid);
    expect(ExdrawUsers.getInstance().getUser(ownUuid, socket.id)).toMatchObject({
      _username: 'user@example.com', username: 'Authenticated user', avatarUrl: '/avatar.png', permission: 'r',
    });
  });

  it('uses the authenticated UUID, filename and author for whiteboard edits', async () => {
    const socket = connect(ExdrawHandler);
    await dispatch(socket, 'elements-updated', { elements: [], version: 16, user: { _username: 'victim@example.com' } }, jest.fn());
    expect(documentManager.execOperationsBySocket).toHaveBeenCalledWith(expect.objectContaining({
      doc_uuid: ownUuid, user: socket.userInfo,
    }), 'Authorized.sdoc');
    expect(ioHelper.sendElementsMessageToRoom).toHaveBeenCalledWith(socket, ownUuid, expect.objectContaining({ user: socket.userInfo, version: 17 }));
  });

  it('binds whiteboard mouse events to the authenticated document and user', async () => {
    const socket = connect(ExdrawHandler);
    await dispatch(socket, 'mouse-location-updated', { user: { _username: 'victim@example.com' }, pointer: { x: 1, y: 2 } });
    expect(ioHelper.sendMouseMessageToRoom).toHaveBeenCalledWith(socket, ownUuid, expect.objectContaining({ user: socket.userInfo }));
  });

  it('does not allow legacy whiteboard broadcasts to bypass versioned edits', async () => {
    const socket = connect(ExdrawHandler);
    const callback = jest.fn();
    await dispatch(socket, 'server-volatile-broadcast', { elements: [] }, callback);
    expect(callback).toHaveBeenCalledWith({ success: false, error_type: 'unsupported_event' });
    expectNoDocumentEffects();
  });

  it('does not rejoin a room when an expired event disconnects the socket during loading', async () => {
    const socket = connect();
    let resolveLoad;
    documentManager.getDoc.mockReturnValue(new Promise(resolve => { resolveLoad = resolve; }));
    const join = dispatch(socket, 'join-room', jest.fn());
    jest.advanceTimersByTime(301000);
    await dispatch(socket, 'reload-image', {}, jest.fn());
    resolveLoad({ version: 16 });
    await join;
    expect(socket.join).not.toHaveBeenCalled();
    expect(SdocUsers.getInstance().users.size).toBe(0);
    expect(documentManager.saveDoc).not.toHaveBeenCalled();
  });

  it('does not return document content after an expired event disconnects the socket during loading', async () => {
    const socket = connect();
    let resolveLoad;
    documentManager.getDoc.mockReturnValue(new Promise(resolve => { resolveLoad = resolve; }));
    const callback = jest.fn();
    const sync = dispatch(socket, 'sync-document', { version: -1001 }, callback);
    jest.advanceTimersByTime(301000);
    await dispatch(socket, 'reload-image', {}, jest.fn());
    resolveLoad({ version: 16, elements: [{ text: 'Must not be disclosed' }] });
    await sync;
    expect(socket.disconnected).toBe(true);
    expect(callback).not.toHaveBeenCalled();
  });

  it.each(['join-room', 'sync-document'])('stops %s after disconnect even when the token is still valid', async event => {
    const socket = connect();
    let resolveLoad;
    documentManager.getDoc.mockReturnValue(new Promise(resolve => { resolveLoad = resolve; }));
    const callback = jest.fn();
    const pending = dispatch(socket, event, { version: -1001 }, callback);
    socket.disconnect();
    resolveLoad({ version: 16, elements: [{ text: 'Must not be disclosed' }] });
    await pending;
    expect(callback).not.toHaveBeenCalled();
    expect(socket.join).not.toHaveBeenCalled();
    expect(SdocUsers.getInstance().users.size).toBe(0);
    expect(documentManager.saveDoc).not.toHaveBeenCalled();
    Object.values(ioHelper).forEach(mock => expect(mock).not.toHaveBeenCalled());
  });

  it('does not return operations after an expired event disconnects the socket during lookup', async () => {
    const socket = connect();
    let resolveOperations;
    operationsManager.getLoseOperationList.mockReturnValue(new Promise(resolve => { resolveOperations = resolve; }));
    const callback = jest.fn();
    const sync = dispatch(socket, 'sync-document', { version: 15 }, callback);
    await Promise.resolve();
    expect(operationsManager.getLoseOperationList).toHaveBeenCalledWith(ownUuid, 15);
    jest.advanceTimersByTime(301000);
    await dispatch(socket, 'reload-image', {}, jest.fn());
    resolveOperations([{ version: 16, operations: [] }]);
    await sync;
    expect(socket.disconnected).toBe(true);
    expect(callback).not.toHaveBeenCalled();
  });

  it.each([
    [SdocHandler, 'join-room', 'getDoc'],
    [SdocHandler, 'sync-document', 'getDoc'],
    [SdocHandler, 'update-document', 'execOperationsBySocket'],
    [ExdrawHandler, 'elements-updated', 'execOperationsBySocket'],
  ])('allows an authorized event to finish without rechecking expiration: %p %s', async (Handler, event, method) => {
    const socket = connect(Handler);
    let resolveOperation;
    documentManager[method].mockReturnValue(new Promise(resolve => { resolveOperation = resolve; }));
    const callback = jest.fn();
    const pending = dispatch(socket, event, {
      version: -1001, operations: [{ type: 'insert_text', text: 'Edit' }], elements: [],
    }, callback);
    // Move past expiration while the authorized event is still running.
    jest.advanceTimersByTime(301000);
    resolveOperation({ success: true, version: 16, elements: [{ text: 'Authorized content' }] });
    await pending;
    expect(documentManager[method]).toHaveBeenCalledTimes(1);
    expect(socket.disconnected).toBe(false);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ success: event === 'join-room' ? 1 : true }));
    if (event === 'join-room') expect(socket.join).toHaveBeenCalledWith(ownUuid);
  });

  it.each([SdocHandler, ExdrawHandler])('completes room membership before a queued disconnect: %p', async Handler => {
    const socket = connect(Handler);
    const usersManager = Handler === SdocHandler ? SdocUsers.getInstance() : ExdrawUsers.getInstance();
    socket.join.mockImplementation(room => {
      socket.rooms.add(room);
      Promise.resolve().then(() => socket.disconnect());
    });
    const acknowledgements = [];
    const callback = jest.fn(result => acknowledgements.push({
      result,
      connected: socket.connected,
      joined: socket.rooms.has(ownUuid),
      user: usersManager.getUser(ownUuid, socket.id),
    }));
    await dispatch(socket, 'join-room', {}, callback);
    expect(socket.join).toHaveBeenCalledWith(ownUuid);
    expect(acknowledgements).toEqual([{
      result: Handler === SdocHandler ? { success: 1, version: 16 } : { success: true },
      connected: true,
      joined: true,
      user: socket.userInfo,
    }]);
    expect(socket.rooms.has(ownUuid)).toBe(false);
    expect(SdocUsers.getInstance().users.size).toBe(0);
    expect(ExdrawUsers.getInstance().users.size).toBe(0);
  });

  it.each([
    [SdocHandler, 'update-document', 'sendMessageToRoom', 'expiration'],
    [SdocHandler, 'update-document', 'sendMessageToRoom', 'transport'],
    [ExdrawHandler, 'elements-updated', 'sendElementsMessageToRoom', 'expiration'],
    [ExdrawHandler, 'elements-updated', 'sendElementsMessageToRoom', 'transport'],
  ])(
    'broadcasts committed edits after disconnection: %p %s via %s (%s)', async (Handler, event, broadcast, reason) => {
      const socket = connect(Handler);
      let resolveEdit;
      documentManager.execOperationsBySocket.mockReturnValue(new Promise(resolve => { resolveEdit = resolve; }));
      const callback = jest.fn();
      const params = { version: 16, operations: [{ type: 'insert_text', text: 'Edit' }], elements: [] };
      const edit = dispatch(socket, event, params, callback);
      if (reason === 'expiration') {
        jest.advanceTimersByTime(301000);
        await dispatch(socket, 'leave-room', {}, jest.fn());
      } else {
        socket.disconnect();
      }
      resolveEdit({ success: true, version: 17 });
      await edit;
      expect(socket.disconnected).toBe(true);
      expect(callback).not.toHaveBeenCalled();
      expect(ioHelper[broadcast]).toHaveBeenCalledTimes(1);
      expect(ioHelper[broadcast]).toHaveBeenCalledWith(socket, ownUuid, expect.objectContaining({
        [event === 'update-document' ? 'operations' : 'elements']: params[event === 'update-document' ? 'operations' : 'elements'],
        version: 17, user: socket.userInfo,
      }));
      Object.entries(ioHelper).forEach(([name, mock]) => {
        if (name !== broadcast) expect(mock).not.toHaveBeenCalled();
      });
    }
  );

  it.each([
    [SdocHandler, 'update-document', false], [SdocHandler, 'update-document', true],
    [ExdrawHandler, 'elements-updated', false], [ExdrawHandler, 'elements-updated', true],
  ])(
    'does not broadcast or reply when a disconnected edit fails: %p %s rejection=%s', async (Handler, event, rejection) => {
      const socket = connect(Handler);
      let finishEdit;
      documentManager.execOperationsBySocket.mockReturnValue(new Promise((resolve, reject) => {
        finishEdit = rejection ? () => reject(new Error('Save failed')) : () => resolve({ success: false, error_type: 'version_behind_server' });
      }));
      const callback = jest.fn();
      const edit = dispatch(socket, event, { version: 16, operations: [], elements: [] }, callback);
      socket.disconnect();
      finishEdit();
      await edit;
      expect(callback).not.toHaveBeenCalled();
      Object.values(ioHelper).forEach(mock => expect(mock).not.toHaveBeenCalled());
    }
  );

  it.each([[SdocHandler, 'update-document'], [ExdrawHandler, 'elements-updated']])(
    'handles rejected manager calls inside the listener: %p %s', async (Handler, event) => {
      const socket = connect(Handler);
      documentManager.execOperationsBySocket.mockRejectedValue(new Error('Save failed'));
      const callback = jest.fn();
      await dispatch(socket, event, { version: 16, operations: [], elements: [] }, callback);
      expect(callback).toHaveBeenCalledWith({ success: false, error_type: 'server_error' });
      Object.values(ioHelper).forEach(mock => expect(mock).not.toHaveBeenCalled());
    }
  );

  it.each([SdocHandler, ExdrawHandler])('cleans up room membership only once across leave and disconnect: %p', async Handler => {
    const socket = connect(Handler);
    await dispatch(socket, 'join-room', {}, jest.fn());
    await dispatch(socket, 'leave-room');
    await dispatch(socket, 'disconnect');
    expect(socket.rooms.has(ownUuid)).toBe(false);
    const save = Handler === SdocHandler ? documentManager.saveDoc : documentManager.saveSceneDoc;
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(ownUuid);
  });
});
