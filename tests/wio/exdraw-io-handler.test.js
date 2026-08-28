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
    rooms: new Set(['doc-1']),
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
});
