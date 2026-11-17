jest.mock('../../src/config/config', () => ({ SEADOC_PRIVATE_KEY: 'existing-jwt-test-key' }));
jest.mock('../../src/modules/exdraw/managers/excalidraw-manager', () => ({
  __esModule: true,
  default: { getInstance: jest.fn() },
}));
jest.mock('../../src/modules/sdoc/managers/document-manager', () => ({
  __esModule: true,
  default: { getInstance: jest.fn() },
}));

import http from 'http';
import express from 'express';
import jwt from 'jsonwebtoken';
import router from '../../src/modules/exdraw/shared-route';
import ExcalidrawManager from '../../src/modules/exdraw/managers/excalidraw-manager';
import DocumentManager from '../../src/modules/sdoc/managers/document-manager';

const fileUuid = '11111111-2222-4333-8444-555555555555';
const base = `/api/internal/v1/shared-exdraw/${fileUuid}`;
const key = 'existing-jwt-test-key';
const parentUuid = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const serviceUrl = 'https://seafile.test/seahub';
const boardLink = `${serviceUrl}/smart-link/${fileUuid}/?readonly=true&filetype=Excalidraw`;
const sign = (overrides = {}, signingKey = key) => jwt.sign({
  iss: 'seahub', aud: 'sdoc-server-shared-exdraw', purpose: 'shared-exdraw-read',
  file_uuid: fileUuid, filename: 'board.exdraw', shared_by: 'owner@example.com',
  permission: 'r', operation: 'read_scene', exp: Math.floor(Date.now() / 1000) + 60,
  sdoc_uuid: parentUuid, sdoc_filename: 'document.sdoc', service_url: serviceUrl,
  ...overrides,
}, signingKey, { algorithm: 'HS256' });

describe('server-only shared whiteboard routes', () => {
  let server;
  const getSceneDoc = jest.fn();
  const getDoc = jest.fn();

  const request = (path, token, method = 'GET') => new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1', port: server.address().port, path, method,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) }));
    });
    req.on('error', reject);
    req.end();
  });

  beforeAll(done => {
    const app = express();
    app.use(router);
    server = app.listen(0, '127.0.0.1', done);
  });

  beforeEach(() => {
    getSceneDoc.mockReset().mockResolvedValue({ version: 1, elements: [] });
    ExcalidrawManager.getInstance.mockReturnValue({ getSceneDoc });
    getDoc.mockReset().mockResolvedValue({ elements: [{ type: 'whiteboard', link: boardLink }] });
    DocumentManager.getInstance.mockReturnValue({ getDoc });
  });

  afterAll(done => { server.close(done); });

  it('loads only the authenticated target referenced by the current sdoc', async () => {
    const response = await request(`${base}/scene/`, sign());
    expect(response.status).toBe(200);
    expect(response.body.elements).toEqual([]);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(getSceneDoc).toHaveBeenCalledWith(fileUuid, 'board.exdraw', 'owner@example.com');
    expect(getDoc).toHaveBeenCalledWith(parentUuid, 'document.sdoc', undefined, 'owner@example.com');
  });

  it.each([
    { elements: [] },
    { elements: [{ type: 'paragraph', link: boardLink }] },
    { elements: [{ type: 'whiteboard', link: boardLink.replace(fileUuid, parentUuid) }] },
    { elements: [{ type: 'whiteboard', link: boardLink.replace('seafile.test', 'evil.test') }] },
    { elements: [{ type: 'whiteboard', link: boardLink.replace('/seahub/', '/another/') }] },
  ])('rejects an unrelated whiteboard before reading it', async ({ elements }) => {
    getDoc.mockResolvedValue({ elements });
    expect((await request(`${base}/scene/`, sign())).status).toBe(403);
    expect(getSceneDoc).not.toHaveBeenCalled();
  });

  it('verifies previews without loading the whiteboard', async () => {
    expect((await request(`${base}/reference/`, sign({ operation: 'verify_reference' }))).body).toEqual({ referenced: true });
    expect(getSceneDoc).not.toHaveBeenCalled();
  });

  it('rejects both operations when the last reference has been removed', async () => {
    expect((await request(`${base}/reference/`, sign({ operation: 'verify_reference' }))).status).toBe(200);
    getDoc.mockResolvedValue({ elements: [] });
    expect((await request(`${base}/reference/`, sign({ operation: 'verify_reference' }))).status).toBe(403);
    expect((await request(`${base}/scene/`, sign())).status).toBe(403);
    expect(getSceneDoc).not.toHaveBeenCalled();
  });

  it('uses the authenticated parent, not a query-string parent override', async () => {
    expect((await request(`${base}/scene/?sdoc_uuid=another-parent`, sign())).status).toBe(200);
    expect(getDoc.mock.calls[0][0]).toBe(parentUuid);
  });

  it('does not read the board when the parent cannot be loaded', async () => {
    getDoc.mockRejectedValue(new Error('Parent unavailable'));
    expect((await request(`${base}/scene/`, sign())).status).toBe(502);
    expect(getSceneDoc).not.toHaveBeenCalled();
  });

  it.each([
    { permission: 'rw' }, { purpose: 'sdoc' }, { aud: 'browser' },
    { operation: 'resolve_image' }, { file_uuid: 'another-file' },
    { sdoc_uuid: undefined }, { sdoc_uuid: 'not-a-uuid' }, { sdoc_filename: '' },
    { service_url: 'javascript:alert(1)' },
    { exp: Math.floor(Date.now() / 1000) - 1 },
    { exp: Math.floor(Date.now() / 1000) + 3600 },
  ])('rejects a token outside its read scope: %j', async payload => {
    expect((await request(`${base}/scene/`, sign(payload))).status).toBe(403);
    expect(getSceneDoc).not.toHaveBeenCalled();
  });

  it('rejects missing credentials and signatures from another key', async () => {
    expect((await request(`${base}/scene/`)).status).toBe(403);
    expect((await request(`${base}/scene/`, sign({}, 'legacy-browser-key'))).status).toBe(403);
    expect(getSceneDoc).not.toHaveBeenCalled();
  });

  it('rejects legacy browser tokens even when signed with the same key', async () => {
    const legacy = jwt.sign({ file_uuid: fileUuid, permission: 'r' }, key, { expiresIn: '3d' });
    expect((await request(`${base}/scene/`, legacy)).status).toBe(403);
    expect(getSceneDoc).not.toHaveBeenCalled();
  });

  it('does not expose a write operation', async () => {
    expect((await request(`${base}/scene/`, sign(), 'POST')).status).toBe(405);
    expect(getSceneDoc).not.toHaveBeenCalled();
  });
});
