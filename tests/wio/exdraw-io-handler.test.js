import ExdrawIOHandler from '../../src/modules/exdraw/wio/io-handler';
import checkPermission from '../../src/modules/exdraw/wio/is-permission-valid';

jest.mock('../../src/modules/exdraw/wio/is-permission-valid', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../../src/loggers', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const createSocket = () => {
  const handlers = {};
  const socket = {
    id: 'socket-1',
    authToken: 'expired-token',
    docUuid: 'doc-1',
    userInfo: {
      username: 'auth-user',
      name: 'Authenticated User',
      permission: 'rw',
      avatar_url: 'avatar.png',
    },
    rooms: new Set(['doc-1']),
    join: jest.fn().mockResolvedValue(),
    on: jest.fn((event, callback) => {
      handlers[event] = callback;
    }),
    to: jest.fn(() => ({
      volatile: {
        emit: jest.fn(),
      },
    })),
  };
  return { socket, handlers };
};

const createIO = () => ({
  of: jest.fn(() => ({
    to: jest.fn(() => ({
      emit: jest.fn(),
    })),
  })),
});

describe('ExdrawIOHandler preview permission', () => {
  beforeEach(() => {
    checkPermission.mockReset();
    ExdrawIOHandler.instance = null;
  });

  it('does not forward a preview when the socket token has expired', async () => {
    checkPermission.mockReturnValue(false);
    const { socket, handlers } = createSocket();
    const handler = ExdrawIOHandler.getInstance(createIO());

    handler.onConnection(socket);
    await handlers['server-volatile-broadcast']({
      doc_uuid: 'doc-1',
      gestureId: 'gesture-1',
      seq: 1,
      elements: [{ id: 'element-1' }],
    });

    expect(checkPermission).toHaveBeenCalledWith(socket);
    expect(socket.to).not.toHaveBeenCalled();
  });


  it('joins the authenticated room and ignores forged client parameters', async () => {
    const { socket, handlers } = createSocket();
    const handler = ExdrawIOHandler.getInstance(createIO());
    const callback = jest.fn();

    handler.onConnection(socket);
    await handlers['join-room']({
      doc_uuid: 'forged-doc',
      user: { username: 'forged-user' },
    }, callback);

    expect(socket.join).toHaveBeenCalledWith('doc-1');
    expect(callback).toHaveBeenCalledWith({
      success: true,
      doc_uuid: 'doc-1',
    });
  });

  it('rejects join-room when authenticated socket identity is missing', async () => {
    const { socket, handlers } = createSocket();
    delete socket.docUuid;
    const handler = ExdrawIOHandler.getInstance(createIO());
    const callback = jest.fn();

    handler.onConnection(socket);
    await handlers['join-room']({}, callback);

    expect(socket.join).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith({
      success: false,
      error_type: 'invalid_join_room',
    });
  });

  it('returns a join-room error when joining the room fails', async () => {
    const { socket, handlers } = createSocket();
    socket.join.mockRejectedValue(new Error('join failed'));
    const handler = ExdrawIOHandler.getInstance(createIO());
    const callback = jest.fn();

    handler.onConnection(socket);
    await handlers['join-room']({
      doc_uuid: 'doc-1',
      user: { username: 'auth-user' },
    }, callback);

    expect(callback).toHaveBeenCalledWith({
      success: false,
      error_type: 'join_room_error',
    });
  });
});
