import http from 'http';
import jwt from 'jsonwebtoken';
import app from '../../src/app';
import { documentController } from '../../src/modules/sdoc/controllers';

jest.mock('../../src/config/config', () => ({
  ...jest.requireActual('../../src/config/config'),
  SEADOC_PRIVATE_KEY: 'auth-test-private-key',
  RATE_LIMIT_MAX: 1000,
}));

// Keep the real app, authentication and routers, but stop before any document side effects.
jest.mock('../../src/modules/sdoc/controllers', () => {
  const handle = jest.fn((req, res) => res.send({
    doc_uuid: req.params.doc_uuid,
    file_uuid: req.payload.file_uuid,
  }));
  return {
    documentController: {
      loadDocContent: handle, saveDocContent: handle, removeContent: handle,
      normalizeSdoc: handle, saveDoc: handle, publishDoc: handle, reloadDoc: handle,
    },
    userController: { getCollaborators: handle },
    commentController: { listComments: handle, insertComment: handle, deleteComment: handle, updateComment: handle },
    replyController: { listReplies: handle, insertReply: handle, deleteReply: handle, updateReply: handle },
    participantController: { addParticipants: handle, removeParticipant: handle },
    systemController: { getInfo: handle },
  };
});

jest.mock('../../src/modules/exdraw/controllers/exdraw-controller', () => {
  const { documentController } = require('../../src/modules/sdoc/controllers');
  return {
    __esModule: true,
    default: {
      loadSceneContent: documentController.loadDocContent,
      saveSceneContent: documentController.loadDocContent,
    },
  };
});

const targetUuid = 'e2ba485d-0000-4000-8000-000000000001';
const otherUuid = '04b7f88a-0000-4000-8000-000000000002';
const documentRoutes = [
  ['GET', 'docs', '/'],
  ['POST', 'docs', '/'],
  ['DELETE', 'docs', '/'],
  ['GET', 'docs', '/normalize-sdoc'],
  ['POST', 'docs', '/save/'],
  ['POST', 'docs', '/publish/'],
  ['POST', 'docs', '/replace/'],
  ['GET', 'docs', '/collaborators'],
  ['GET', 'docs', '/comment/'],
  ['POST', 'docs', '/comment/'],
  ['DELETE', 'docs', '/comment/12/'],
  ['PUT', 'docs', '/comment/12/'],
  ['GET', 'docs', '/comment/12/replies/'],
  ['POST', 'docs', '/comment/12/replies/'],
  ['DELETE', 'docs', '/comment/12/replies/34/'],
  ['PUT', 'docs', '/comment/12/replies/34/'],
  ['POST', 'docs', '/participants/'],
  ['DELETE', 'docs', '/participants/'],
  ['GET', 'exdraw', '/'],
  ['POST', 'exdraw', '/'],
].map(([method, resource, suffix]) => [method, `/api/v1/${resource}/${targetUuid}${suffix}?from=seahub`]);

describe('HTTP document authorization', () => {
  let server;

  const request = (method, path, payload, { token, signOptions } = {}) => new Promise((resolve, reject) => {
    const authorization = token === null ? {} : {
      Authorization: `Token ${token || jwt.sign(payload, 'auth-test-private-key', { algorithm: 'HS256', ...signOptions })}`,
    };
    const req = http.request({
      hostname: '127.0.0.1', port: server.address().port, method, path, headers: authorization,
    }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });

  const expectDenied = response => {
    expect(response.status).toBe(403);
    expect(JSON.parse(response.body)).toHaveProperty('error_msg');
    expect(documentController.loadDocContent).not.toHaveBeenCalled();
  };

  beforeAll(async () => {
    server = http.createServer(app);
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
  });

  beforeEach(() => jest.clearAllMocks());

  afterAll(async () => {
    if (server.listening) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  it.each(documentRoutes)('rejects a token for another document on %s %s', async (method, path) => {
    expectDenied(await request(method, path, { file_uuid: otherUuid, permission: 'rw' }));
  });

  it.each(documentRoutes)('rejects a token without file_uuid on %s %s', async (method, path) => {
    expectDenied(await request(method, path, { username: 'user@example.com', permission: 'rw' }));
  });

  it.each(documentRoutes)('allows a matching document token on %s %s', async (method, path) => {
    const response = await request(method, path, { file_uuid: targetUuid });
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ doc_uuid: targetUuid, file_uuid: targetUuid });
    expect(documentController.loadDocContent).toHaveBeenCalledTimes(1);
  });

  it.each([
    '/api/v1/docs/', '/api/v1/exdraw/', '/unknown/', '/files/doc-1/',
    '/api/v1/docs//collaborators',
  ])('fails closed when the target cannot be parsed: %s', async path => {
    expectDenied(await request('GET', path, { file_uuid: targetUuid }));
  });

  it.each([
    `/API/V1/DOCS/${targetUuid}/collaborators`,
    `/api/v1/docs/${targetUuid.replace(/-/g, '%2D')}/collaborators`,
    `/api/v1/docs/${targetUuid}/collaborators?file_uuid=${otherUuid}`,
  ])('matches Express routing and decoding for %s', async path => {
    expectDenied(await request('GET', path, { file_uuid: otherUuid }));
    expect((await request('GET', path, { file_uuid: targetUuid })).status).toBe(200);
  });

  it.each([
    { token: null },
    { token: 'invalid-token' },
    { signOptions: { expiresIn: -1 } },
    { signOptions: { algorithm: 'HS384' } },
  ])('rejects missing, invalid, expired or unsupported tokens: %p', async options => {
    expectDenied(await request('GET', `/api/v1/docs/${targetUuid}/collaborators`, { file_uuid: targetUuid }, options));
  });

  it.each(['', null, 123, [], {}])('rejects an invalid file_uuid claim: %p', async file_uuid => {
    expectDenied(await request('GET', `/api/v1/docs/${targetUuid}/collaborators`, { file_uuid }));
  });

  it('rejects a signed string payload without document claims', async () => {
    expectDenied(await request('GET', `/api/v1/docs/${targetUuid}/collaborators`, 'not-a-document-token'));
  });

  it('rejects an empty verification result without throwing', async () => {
    const verify = jest.spyOn(jwt, 'verify').mockImplementation((token, key, options, callback) => callback(null, null));
    try {
      expectDenied(await request('GET', `/api/v1/docs/${targetUuid}/collaborators`, { file_uuid: targetUuid }));
    } finally {
      verify.mockRestore();
    }
  });

  it('preserves the explicit system info endpoint for an administrator token without file_uuid', async () => {
    expect((await request('GET', '/api/v1/docs/system/info/?from=seahub', { admin: true })).status).toBe(200);
    expect((await request('HEAD', '/API/V1/DOCS/system/info', { admin: true })).status).toBe(200);
  });

  it.each([{}, { admin: false }, { admin: 'true' }, { file_uuid: targetUuid }])(
    'rejects a non-administrator token on system info: %p', async payload => {
      expectDenied(await request('GET', '/api/v1/docs/system/info/', payload));
    }
  );

  it.each([
    ['GET', `/api/v1/docs/${targetUuid}/collaborators`],
    ['DELETE', `/api/v1/docs/${targetUuid}/`],
    ['GET', '/unknown/'],
    ['GET', '/api/v1/docs/system/info/extra'],
    ['POST', '/api/v1/docs/system/info/'],
  ])('does not grant administrator tokens unbound access to %s %s', async (method, path) => {
    expectDenied(await request(method, path, { admin: true, file_uuid: otherUuid }));
  });
});
