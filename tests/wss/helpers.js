import { EventEmitter } from 'events';
import jwt from 'jsonwebtoken';
import auth from '../../src/wss/auth';

export const privateKey = 'socket-test-private-key';
export const ownUuid = 'e2ba485d-0000-4000-8000-000000000001';
export const foreignUuid = '04b7f88a-0000-4000-8000-000000000002';

export const signToken = (claims = {}, options = {}) => {
  const payload = {
    file_uuid: ownUuid, filename: 'Authorized.sdoc', username: 'user@example.com',
    name: 'Authenticated user', avatar_url: '/avatar.png', permission: 'rw',
    exp: Math.floor(Date.now() / 1000) + 300, ...claims,
  };
  Object.keys(payload).forEach(key => {
    if (payload[key] === undefined) delete payload[key];
  });
  return jwt.sign(payload, privateKey, { algorithm: 'HS256', noTimestamp: true, ...options });
};

export const createSocket = (token = signToken()) => {
  const socket = new EventEmitter();
  socket.id = 'socket-1';
  socket.handshake = { auth: { token } };
  socket.connected = true;
  socket.disconnected = false;
  socket.rooms = new Set();
  socket.middlewares = [];
  socket.use = jest.fn(middleware => {
    socket.middlewares.push(middleware);
    return socket;
  });
  socket.join = jest.fn(room => socket.rooms.add(room));
  socket.leave = jest.fn(room => socket.rooms.delete(room));
  socket.disconnect = jest.fn(() => {
    if (socket.disconnected) return;
    socket.connected = false;
    socket.disconnected = true;
    socket.rooms.clear();
    socket.emit('disconnect');
  });
  return socket;
};

export const authenticateSocket = (claims = {}) => {
  const socket = createSocket(signToken(claims));
  const next = jest.fn();
  auth(socket, next);
  expect(next).toHaveBeenCalledWith();
  return socket;
};

export const dispatch = (socket, event, ...args) => {
  const packet = [event, ...args];
  const invokeHandler = () => {
    const [handler] = socket.listeners(event);
    if (!handler) throw new Error(`Missing event handler: ${event}`);
    return handler(...packet.slice(1));
  };
  // Socket.IO runs middleware for client packets, not its own disconnect event.
  if (event === 'disconnect') return invokeHandler();
  const run = index => {
    const middleware = socket.middlewares[index];
    if (!middleware) return invokeHandler();
    let result;
    middleware(packet, error => {
      if (error) throw error;
      result = run(index + 1);
    });
    return result;
  };
  return run(0);
};
