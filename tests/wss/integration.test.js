import http from 'http';
import { Server } from 'socket.io';
import IOServer from '../../src/wss';
import DocumentManager from '../../src/modules/sdoc/managers/document-manager';
import ExdrawManager from '../../src/modules/exdraw/managers/excalidraw-manager';
import SdocUsers from '../../src/modules/sdoc/managers/users-manager';
import ExdrawUsers from '../../src/modules/exdraw/managers/users-manager';
import { foreignUuid, ownUuid, signToken } from './helpers';

jest.mock('../../src/config/config', () => ({ SEADOC_PRIVATE_KEY: 'socket-test-private-key' }));
jest.mock('../../src/modules/sdoc/managers/document-manager', () => ({ __esModule: true, default: { getInstance: jest.fn() } }));
jest.mock('../../src/modules/sdoc/managers/operations-manager', () => ({
  __esModule: true, default: { getInstance: () => ({ getLoseOperationList: jest.fn().mockResolvedValue([]) }) },
}));
jest.mock('../../src/modules/exdraw/managers/excalidraw-manager', () => ({ __esModule: true, default: { getInstance: jest.fn() } }));
jest.mock('../../src/modules/sdoc/api/sea-server-api', () => ({
  __esModule: true, default: { editorStatusCallback: jest.fn().mockResolvedValue({}) },
}));

// Exercise the installed Engine.IO/Socket.IO polling protocol without a new client dependency.
describe('Socket.IO transport authorization', () => {
  let server;
  let io;
  let clients;
  let manager;

  const request = (method, path, body = '') => new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1', port: server.address().port, method, path,
      headers: { 'Content-Type': 'text/plain', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(2000, () => req.destroy(new Error('Socket polling request timed out')));
    req.end(body);
  });

  const connect = async (namespace = '/', claims = {}) => {
    const basePath = '/socket.io/?EIO=4&transport=polling';
    const open = await request('GET', basePath);
    const { sid } = JSON.parse(open.slice(1));
    clients.push(sid);
    const path = `${basePath}&sid=${sid}`;
    const prefix = namespace === '/' ? '' : `${namespace},`;
    await request('POST', path, `40${prefix}${JSON.stringify({ token: signToken(claims) })}`);
    const packets = (await request('GET', path)).split('\x1e');
    expect(packets.some(packet => packet.startsWith(`40${prefix}`))).toBe(true);
    const socket = [...io.of(namespace).sockets.values()].find(socket => socket.client.id === sid);
    let ackId = 0;
    return {
      socket,
      send: (event, params) => request('POST', path, `42${prefix}${JSON.stringify([event, params])}`),
      receive: async () => (await request('GET', path)).split('\x1e'),
      emit: async (event, params) => {
        const id = ackId++;
        const args = params === undefined ? [event] : [event, params];
        await request('POST', path, `42${prefix}${id}${JSON.stringify(args)}`);
        for (let attempt = 0; attempt < 4; attempt++) {
          const packets = (await request('GET', path)).split('\x1e');
          const ack = packets.find(packet => packet.startsWith(`43${prefix}${id}[`));
          if (ack) return JSON.parse(ack.slice(`43${prefix}${id}`.length))[0];
        }
        throw new Error(`Missing acknowledgement for ${event}`);
      },
    };
  };

  beforeAll(async () => {
    server = http.createServer();
    io = new Server(server, { transports: ['polling'], serveClient: false });
    new IOServer(io);
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
  });

  beforeEach(() => {
    clients = [];
    SdocUsers.getInstance().users.clear();
    ExdrawUsers.getInstance().users.clear();
    manager = {
      getDoc: jest.fn().mockResolvedValue({ version: 16, elements: [{ text: 'Authorized content' }] }),
      execOperationsBySocket: jest.fn().mockResolvedValue({ success: true, version: 17 }),
      saveDoc: jest.fn().mockResolvedValue(true), saveSceneDoc: jest.fn().mockResolvedValue(true),
      deleteCursor: jest.fn(),
    };
    DocumentManager.getInstance.mockReturnValue(manager);
    ExdrawManager.getInstance.mockReturnValue(manager);
  });

  afterEach(async () => {
    clients.forEach(sid => io.engine.clients[sid]?.close(true));
    await new Promise(resolve => setImmediate(resolve));
  });

  afterAll(async () => {
    if (io) await new Promise(resolve => io.close(resolve));
  });

  it('rejects the reported cross-document full-content request over the real transport', async () => {
    const client = await connect('/', { permission: 'r' });
    const listener = jest.fn();
    client.socket.prependListener('sync-document', listener);
    expect(await client.emit('sync-document', { doc_uuid: foreignUuid, version: -1001 })).toEqual({
      success: false, error_type: 'permission_denied',
    });
    expect(listener).not.toHaveBeenCalled();
    expect(manager.getDoc).not.toHaveBeenCalled();
    expect(await client.emit('sync-document', { doc_uuid: ownUuid, version: -1001 })).toMatchObject({
      success: true, mode: 'document', content: { version: 16 },
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(manager.getDoc).toHaveBeenCalledWith(ownUuid, 'Authorized.sdoc');
  });

  it.each(['/', '/exdraw'])('rejects malformed and unconfigured events before listeners in namespace %s', async namespace => {
    const client = await connect(namespace);
    const joinListener = jest.fn();
    const unknownListener = jest.fn();
    client.socket.prependListener('join-room', joinListener);
    client.socket.on('unknown-event', unknownListener);
    expect(await client.emit('join-room', null)).toEqual({ success: false, error_type: 'invalid_params' });
    expect(await client.emit('unknown-event', {})).toEqual({ success: false, error_type: 'unsupported_event' });
    expect(joinListener).not.toHaveBeenCalled();
    expect(unknownListener).not.toHaveBeenCalled();
    expect(manager.getDoc).not.toHaveBeenCalled();
    expect(manager.execOperationsBySocket).not.toHaveBeenCalled();
    expect(client.socket.rooms.has(ownUuid)).toBe(false);
  });

  it('binds actual Excalidraw room membership and denies readonly edits', async () => {
    const client = await connect('/exdraw', { permission: 'r' });
    expect(await client.emit('join-room', { doc_uuid: foreignUuid })).toEqual({ success: false, error_type: 'permission_denied' });
    expect(client.socket.rooms.has(foreignUuid)).toBe(false);
    expect(await client.emit('join-room', { doc_uuid: ownUuid })).toEqual({ success: true });
    expect(client.socket.rooms.has(ownUuid)).toBe(true);
    expect(await client.emit('elements-updated', { doc_uuid: ownUuid, elements: [], version: 16 })).toEqual({
      success: false, error_type: 'permission_denied',
    });
    expect(manager.execOperationsBySocket).not.toHaveBeenCalled();
  });

  it('supports normal joins and edits while replacing forged authors', async () => {
    const client = await connect();
    expect(await client.emit('join-room')).toEqual({ success: 1, version: 16 });
    expect(await client.emit('update-document', {
      doc_uuid: ownUuid, version: 16, operations: [{ type: 'insert_text', text: 'Edit' }],
      user: { username: 'victim@example.com' },
    })).toEqual({ success: true, version: 17 });
    expect(manager.execOperationsBySocket).toHaveBeenCalledWith(expect.objectContaining({
      doc_uuid: ownUuid, user: expect.objectContaining({ username: 'user@example.com' }),
    }), 'Authorized.sdoc');
  });

  it.each(['/', '/exdraw'])('removes idle readers from namespace %s when their token expires', async namespace => {
    const client = await connect(namespace, { permission: 'r', exp: Date.now() / 1000 + 0.5 });
    await client.emit('join-room');
    expect(client.socket.rooms.has(ownUuid)).toBe(true);
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Expired socket remained connected')), 1500);
      client.socket.once('disconnect', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
    expect(client.socket.rooms.has(ownUuid)).toBe(false);
    expect(io.of(namespace).sockets.has(client.socket.id)).toBe(false);
  });

  it.each([['/', 'update-document'], ['/exdraw', 'elements-updated']])(
    'delivers committed edits to an online reader after the sender disconnects: %s %s', async (namespace, event) => {
      const sender = await connect(namespace);
      const reader = await connect(namespace, { username: 'reader@example.com', permission: 'r' });
      await sender.emit('join-room');
      await reader.emit('join-room');

      let finishEdit;
      let startEdit;
      const started = new Promise(resolve => { startEdit = resolve; });
      manager.execOperationsBySocket.mockImplementationOnce(() => {
        startEdit();
        return new Promise(resolve => { finishEdit = resolve; });
      });
      const params = { version: 16, operations: [{ type: 'insert_text', text: 'Committed edit' }], elements: [] };
      await sender.send(event, params);
      await started;
      sender.socket.disconnect();
      finishEdit({ success: true, version: 17 });
      await new Promise(resolve => setImmediate(resolve));

      const prefix = namespace === '/' ? '42' : `42${namespace},`;
      let update;
      for (let attempt = 0; attempt < 4 && !update; attempt++) {
        const packets = await reader.receive();
        update = packets.filter(packet => packet.startsWith(prefix))
          .map(packet => JSON.parse(packet.slice(prefix.length)))
          .find(([name]) => name === event);
      }
      expect(update).toEqual([event, expect.objectContaining({
        version: 17, user: expect.objectContaining({ permission: 'rw' }),
        ...(namespace === '/' ? { operations: params.operations } : { elements: params.elements }),
      })]);
      expect(reader.socket.connected).toBe(true);
      expect(reader.socket.rooms.has(ownUuid)).toBe(true);
    }
  );
});
