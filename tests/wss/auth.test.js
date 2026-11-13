import jwt from 'jsonwebtoken';
import auth from '../../src/wss/auth';
import sdocAPI from '../../src/modules/sdoc/api/sea-server-api';
import exdrawAPI from '../../src/modules/exdraw/api/sea-server-api';
import { authenticateSocket, createSocket, ownUuid, privateKey, signToken } from './helpers';

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

  it('disconnects idle readers at expiration', () => {
    jest.setSystemTime(new Date('2026-11-13T00:00:00Z'));
    const socket = authenticateSocket({ permission: 'r', exp: Date.now() / 1000 + 3 });
    jest.advanceTimersByTime(2999);
    expect(socket.disconnect).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(socket.disconnected).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('cleans up expiration timers after disconnect', () => {
    const socket = authenticateSocket();
    socket.disconnect();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('does not immediately disconnect tokens whose lifetime exceeds the timer limit', () => {
    const socket = authenticateSocket({ exp: Math.floor(Date.now() / 1000) + 30 * 86400 });
    jest.advanceTimersByTime(2147483647);
    expect(socket.disconnect).not.toHaveBeenCalled();
    socket.disconnect();
    expect(jest.getTimerCount()).toBe(0);
  });
});
