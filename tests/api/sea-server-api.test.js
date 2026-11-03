import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import sdocAPI from '../../src/modules/sdoc/api/sea-server-api';
import exdrawAPI from '../../src/modules/exdraw/api/sea-server-api';

let mockSeahubServer;

jest.mock('../../src/config/config', () => ({
  SEADOC_PRIVATE_KEY: 'test-private-key',
  get SEAHUB_SERVER() { return mockSeahubServer; },
}));

const listen = server => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const close = server => new Promise(resolve => {
  if (server && server.listening) {
    server.close(resolve);
  } else {
    resolve();
  }
});

describe('Seahub API request boundaries', () => {
  let server;
  let redirectTarget;
  let redirectRequests;
  let redirectStatus;
  let requests;
  let tempDir;
  let filePath;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdoc-api-test-'));
    filePath = path.join(tempDir, 'document.json');
    fs.writeFileSync(filePath, '{}');
    redirectTarget = http.createServer((req, res) => {
      redirectRequests.push(req.url);
      res.end('{}');
    });
    await listen(redirectTarget);
    server = http.createServer((req, res) => {
      requests.push({ method: req.method, url: req.url, authorization: req.headers.authorization });
      req.resume();
      req.on('end', () => {
        if (redirectStatus) {
          res.writeHead(redirectStatus, { Location: `http://127.0.0.1:${redirectTarget.address().port}/private` });
        } else {
          res.setHeader('Content-Type', 'application/json');
        }
        res.end('{}');
      });
    });
    await listen(server);
    // Deployments can mount Seahub under a URL prefix.
    mockSeahubServer = `http://127.0.0.1:${server.address().port}/seahub`;
  });

  beforeEach(() => {
    requests = [];
    redirectRequests = [];
    redirectStatus = null;
  });

  afterAll(async () => {
    await Promise.all([close(server), close(redirectTarget)]);
    fs.unlinkSync(filePath);
    fs.rmdirSync(tempDir);
  });

  const endpoints = [
    [sdocAPI, 'getDocDownloadLink', [], 'GET', 'seadoc/download-link/doc-1/'],
    [sdocAPI, 'getDocUpdateLink', [], 'GET', 'seadoc/upload-link/doc-1/'],
    [sdocAPI, 'getDocContent', [], 'GET', 'seadoc/content/doc-1/'],
    [sdocAPI, 'saveDocContent', () => [{ path: filePath }, 'user@example.com'], 'POST', 'seadoc/upload-file/doc-1/'],
    [sdocAPI, 'listComments', [], 'GET', 'seadoc/comments/doc-1/'],
    [sdocAPI, 'insertComment', [{ comment: 'hello' }], 'POST', 'seadoc/comments/doc-1/'],
    [sdocAPI, 'deleteComment', [12, 'user@example.com'], 'DELETE', 'seadoc/comment/doc-1/12/'],
    [sdocAPI, 'updateComment', ['12', { comment: 'hello' }, 'user@example.com'], 'PUT', 'seadoc/comment/doc-1/12/'],
    [sdocAPI, 'listReplies', ['12'], 'GET', 'seadoc/comment/doc-1/12/replies/'],
    [sdocAPI, 'insertReply', ['12', { reply: 'hello' }], 'POST', 'seadoc/comment/doc-1/12/replies/'],
    [sdocAPI, 'deleteReply', ['12', '34', 'user@example.com'], 'DELETE', 'seadoc/comment/doc-1/12/replies/34/'],
    [sdocAPI, 'updateReply', ['12', 34, { reply: 'hello' }, 'user@example.com'], 'PUT', 'seadoc/comment/doc-1/12/replies/34/'],
    [sdocAPI, 'editorStatusCallback', ['editing'], 'POST', 'seadoc/editor-status-callback/doc-1/'],
    [exdrawAPI, 'getSceneDownloadLink', [], 'GET', 'exdraw/download-link/doc-1/'],
    [exdrawAPI, 'getSceneContent', [], 'GET', 'exdraw/content/doc-1/'],
    [exdrawAPI, 'saveSceneContent', () => [{ path: filePath }, 'user@example.com'], 'POST', 'exdraw/upload-file/doc-1/'],
  ];

  it.each(endpoints.map(([api, method, ...args]) => [method, api, ...args]))('keeps %s on the configured Seahub URL', async (method, api, args, httpMethod, endpoint) => {
    await api[method]('doc-1', ...(typeof args === 'function' ? args() : args));

    expect(requests).toEqual([{
      method: httpMethod,
      url: `/seahub/api/v2.1/${endpoint}`,
      authorization: expect.stringMatching(/^Token /),
    }]);
    expect(redirectRequests).toEqual([]);
  });

  it.each(['../admin', '..', '.', '//127.0.0.1/private', 'https://evil.example', 'doc?next=/admin', 'doc#fragment', '%2e%2e', 'doc\\..\\admin', '', null, {}])(
    'rejects an unsafe document path parameter: %p', async value => {
      for (const [api, method, args] of endpoints) {
        await expect(Promise.resolve().then(() => api[method](value, ...(typeof args === 'function' ? args() : args))))
          .rejects.toThrow('Invalid Seahub API path parameter');
      }
      expect(requests).toEqual([]);
    }
  );

  it.each([
    ['deleteComment', ['../admin', 'user@example.com']],
    ['updateComment', ['12?next=/admin', {}, 'user@example.com']],
    ['listReplies', ['//evil.example']],
    ['insertReply', ['..', {}]],
    ['deleteReply', ['12', '../admin', 'user@example.com']],
    ['updateReply', ['12', '34#fragment', {}, 'user@example.com']],
  ])('rejects unsafe comment/reply IDs in %s', async (method, args) => {
    await expect(Promise.resolve().then(() => sdocAPI[method]('doc-1', ...args)))
      .rejects.toThrow('Invalid Seahub API path parameter');
    expect(requests).toEqual([]);
  });

  it.each([301, 302, 303, 307, 308])('does not follow an upstream %s redirect', async status => {
    redirectStatus = status;
    await expect(sdocAPI.getDocContent('doc-1')).rejects.toMatchObject({ response: { status } });
    await expect(exdrawAPI.getSceneContent('doc-1')).rejects.toMatchObject({ response: { status } });
    expect(requests).toHaveLength(2);
    expect(redirectRequests).toEqual([]);
  });
});
