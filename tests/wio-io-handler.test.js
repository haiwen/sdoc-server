import ExdrawIOHandler from '../src/modules/exdraw/wio/io-handler';
import IOHelper from '../src/modules/exdraw/wio/io-helper';
import UsersManager from '../src/modules/exdraw/managers/users-manager';

jest.mock('../src/modules/exdraw/wio/io-helper');
jest.mock('../src/modules/exdraw/managers/users-manager');
jest.mock('../src/loggers', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

describe('ExdrawIOHandler join-room', () => {
  let ioHelper;
  let usersManager;
  let socket;
  let handlers;

  beforeEach(() => {
    handlers = {};
    ioHelper = {
      sendInitRoomToPrivate: jest.fn(),
      sendRoomUserChangeMessage: jest.fn(),
    };
    usersManager = {
      getUser: jest.fn(),
      addUser: jest.fn(),
      getDocUsers: jest.fn().mockReturnValue([]),
    };
    socket = {
      id: 'socket-id',
      on: jest.fn((event, handler) => {
        handlers[event] = handler;
      }),
      join: jest.fn().mockResolvedValue(undefined),
    };
    IOHelper.getInstance.mockReturnValue(ioHelper);
    UsersManager.getInstance.mockReturnValue(usersManager);
  });

  it('returns a success acknowledgement after joining the room', async () => {
    const callback = jest.fn();
    const handler = new ExdrawIOHandler({});

    handler.onConnection(socket);
    await handlers['join-room']({
      doc_uuid: 'doc-uuid',
      user: { _username: 'user' },
    }, callback);

    expect(socket.join).toHaveBeenCalledWith('doc-uuid');
    expect(ioHelper.sendRoomUserChangeMessage).toHaveBeenCalledWith(socket, 'doc-uuid', []);
    expect(callback).toHaveBeenCalledWith({ success: true });
  });

  it('returns a failure acknowledgement when joining the room throws', async () => {
    const callback = jest.fn();
    socket.join.mockRejectedValue(new Error('adapter unavailable'));
    const handler = new ExdrawIOHandler({});

    handler.onConnection(socket);
    await handlers['join-room']({
      doc_uuid: 'doc-uuid',
      user: { _username: 'user' },
    }, callback);

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error_type: 'join_room_error',
    });
  });

  it('returns a failure acknowledgement when user management throws', async () => {
    const callback = jest.fn();
    usersManager.addUser.mockImplementation(() => {
      throw new Error('user manager unavailable');
    });
    const handler = new ExdrawIOHandler({});

    handler.onConnection(socket);
    await handlers['join-room']({
      doc_uuid: 'doc-uuid',
      user: { _username: 'user' },
    }, callback);

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error_type: 'join_room_error',
    });
  });
});
