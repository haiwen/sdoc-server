import jwt from 'jsonwebtoken';
import auth from '../../src/wss/auth';
import sdocAPI from '../../src/modules/sdoc/api/sea-server-api';
import exdrawAPI from '../../src/modules/exdraw/api/sea-server-api';
import { authenticateSocket, createSocket, dispatch, ownUuid, privateKey, signToken } from './helpers';

jest.mock('../../src/config/config', () => ({ SEADOC_PRIVATE_KEY: 'socket-test-private-key' }));

describe('Socket.IO handshake authorization', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it.each(['r', 'rw'])('preserves existing Seahub tokens with permission %s', permission => {
    const socket = authenticateSocket({ permission });
    expect(socket.docUuid).toBe(ownUuid);
    expect(socket.userInfo).toMatchObject({ username: 'user@example.com', permission });
    expect(Object.isFrozen(socket.payload)).toBe(true);
    expect(socket.use).toHaveBeenCalledTimes(1);
  });

  it('accepts an explicitly marked collaboration token', () => {
    expect(authenticateSocket({ token_type: 'collaboration' }).docUuid).toBe(ownUuid);
  });

  it.each([
    { file_uuid: undefined }, { file_uuid: '' }, { file_uuid: ' ' }, { file_uuid: null },
    { file_uuid: 123 }, { file_uuid: [] }, { file_uuid: {} },
    { username: undefined }, { username: '' }, { username: null }, { username: {} },
    { permission: undefined }, { permission: 'admin' }, { permission: true },
    { exp: undefined }, { token_type: 'service' }, { token_type: null },
    { file_uuid: undefined, permission: undefined, admin: true },
  ])('rejects incomplete or incompatible claims: %p', claims => {
    const socket = createSocket(signToken(claims));
    const next = jest.fn();
    auth(socket, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(socket.payload).toBeUndefined();
    expect(socket.use).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each([
    () => undefined,
    () => 'invalid-token',
    () => signToken({}, { algorithm: 'HS384' }),
    () => signToken({ exp: Math.floor(Date.now() / 1000) - 1 }),
    () => jwt.sign('not-document-claims', privateKey),
    () => jwt.sign({ file_uuid: ownUuid }, 'another-key'),
  ])('rejects missing, invalid, expired or unsupported tokens', getToken => {
    const socket = createSocket();
    socket.handshake.auth = { token: getToken() };
    const next = jest.fn();
    auth(socket, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(socket.docUuid).toBeUndefined();
  });

  it.each([null, '', 123])('rejects an invalid verification result: %p', payload => {
    jest.spyOn(jwt, 'verify').mockReturnValue(payload);
    const next = jest.fn();
    auth(createSocket(), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it.each([sdocAPI, exdrawAPI])('rejects internal service credentials even when they have a username', api => {
    const socket = createSocket(api.generateJwtToken(ownUuid, 'user@example.com'));
    const next = jest.fn();
    auth(socket, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it.each(['r', 'rw'])('notifies idle %s connections before disconnecting at expiration', permission => {
    jest.setSystemTime(new Date('2026-11-13T00:00:00Z'));
    const socket = authenticateSocket({ permission, exp: Date.now() / 1000 + 3 });
    const notified = jest.fn(() => expect(socket.connected).toBe(true));
    socket.on('token-expired', notified);
    jest.advanceTimersByTime(2999);
    expect(socket.disconnect).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(notified).toHaveBeenCalledWith({ error_type: 'token_expired' });
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(socket.disconnected).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('notifies callback-free events when expiration is detected before the timer runs', () => {
    const socket = authenticateSocket();
    const notified = jest.fn();
    socket.on('token-expired', notified);
    const listener = jest.fn();
    socket.on('update-cursor', listener);
    jest.setSystemTime(Date.now() + 301000);
    dispatch(socket, 'update-cursor', {});
    expect(notified).toHaveBeenCalledTimes(1);
    expect(listener).not.toHaveBeenCalled();
    expect(socket.disconnected).toBe(true);
  });

  it('preserves the expired event acknowledgement', () => {
    const socket = authenticateSocket();
    const listener = jest.fn();
    socket.on('sync-document', listener);
    jest.setSystemTime(Date.now() + 301000);

    const callback = jest.fn();
    dispatch(socket, 'sync-document', { version: 0 }, callback);
    expect(callback).toHaveBeenCalledWith({ success: false, error_type: 'token_expired' });
    expect(listener).not.toHaveBeenCalled();
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(socket.disconnected).toBe(true);
  });

  it('exposes a stable expiration code for rejected handshakes', () => {
    const next = jest.fn();
    auth(createSocket(signToken({ exp: Math.floor(Date.now() / 1000) - 1 })), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'jwt expired', data: { code: 'token_expired' },
    }));
  });

  it('cleans up timers when a connection closes early', () => {
    const socket = authenticateSocket();
    socket.disconnect();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('supports lifetimes beyond the Node timer limit', () => {
    const socket = authenticateSocket({ exp: Math.floor(Date.now() / 1000) + 30 * 86400 });
    jest.advanceTimersByTime(2147483647);
    expect(socket.disconnected).toBe(false);
    socket.disconnect();
  });
});
