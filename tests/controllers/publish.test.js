import http from 'http';
import jwt from 'jsonwebtoken';
import FormData from 'form-data';
import app from '../../src/app';
import DocumentManager from '../../src/modules/sdoc/managers/document-manager';
import IOHelper from '../../src/modules/sdoc/wio/io-helper';
import { MESSAGE } from '../../src/modules/sdoc/constants';

jest.mock('../../src/config/config', () => ({
  ...jest.requireActual('../../src/config/config'),
  SEADOC_PRIVATE_KEY: 'publish-test-private-key',
  RATE_LIMIT_MAX: 1000,
}));

jest.mock('../../src/modules/sdoc/managers/document-manager', () => ({
  __esModule: true,
  default: { getInstance: jest.fn() },
}));

jest.mock('../../src/modules/sdoc/wio/io-helper', () => ({
  __esModule: true,
  default: { getInstance: jest.fn() },
}));

const draftUuid = 'e2ba485d-0000-4000-8000-000000000001';
const originUuid = '04b7f88a-0000-4000-8000-000000000002';
const otherUuid = '04b7f88a-0000-4000-8000-000000000003';
const publishPath = `/api/v1/docs/${draftUuid}/publish/?from=seahub`;
const publishClaims = { file_uuid: draftUuid, origin_doc_uuid: originUuid };
const publishBody = { origin_doc_uuid: originUuid, origin_doc_name: 'Original.sdoc' };

describe('publish document authorization', () => {
  let server;
  const documentManager = {
    removeDocFromMemory: jest.fn(),
    isDocInMemory: jest.fn(),
    reloadDoc: jest.fn(),
  };
  const ioHelper = { sendMessageToAllInRoom: jest.fn() };

  const request = (payload = publishClaims, {
    data = publishBody, body = JSON.stringify(data), headers = { 'Content-Type': 'application/json' },
    path = publishPath, token, signOptions,
  } = {}) => new Promise((resolve, reject) => {
    const authorization = token === null ? {} : {
      Authorization: `Token ${token || jwt.sign(payload, 'publish-test-private-key', {
        algorithm: 'HS256', noTimestamp: true, expiresIn: 300, ...signOptions,
      })}`,
    };
    const req = http.request({
      hostname: '127.0.0.1', port: server.address().port, method: 'POST', path,
      headers: { 'Content-Length': Buffer.byteLength(body), ...headers, ...authorization },
    }, res => {
      let responseBody = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { responseBody += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(responseBody) }));
    });
    req.on('error', reject);
    req.end(body);
  });

  const expectDenied = response => {
    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('error_msg');
    expect(DocumentManager.getInstance).not.toHaveBeenCalled();
    expect(IOHelper.getInstance).not.toHaveBeenCalled();
    expect(documentManager.removeDocFromMemory).not.toHaveBeenCalled();
    expect(documentManager.reloadDoc).not.toHaveBeenCalled();
    expect(ioHelper.sendMessageToAllInRoom).not.toHaveBeenCalled();
  };

  beforeAll(async () => {
    server = http.createServer(app);
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    DocumentManager.getInstance.mockReturnValue(documentManager);
    IOHelper.getInstance.mockReturnValue(ioHelper);
    documentManager.removeDocFromMemory.mockResolvedValue(true);
    documentManager.isDocInMemory.mockReturnValue(true);
    documentManager.reloadDoc.mockResolvedValue({});
  });

  afterAll(async () => {
    if (server.listening) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  it('accepts the Seahub token bound to both documents and preserves publish notifications', async () => {
    expect(await request()).toEqual({ status: 200, body: { success: true } });
    expect(documentManager.removeDocFromMemory).toHaveBeenCalledWith(draftUuid);
    expect(documentManager.reloadDoc).toHaveBeenCalledWith(originUuid, publishBody.origin_doc_name);
    expect(ioHelper.sendMessageToAllInRoom.mock.calls).toEqual([
      [draftUuid, MESSAGE.DOC_PUBLISHED],
      [originUuid, MESSAGE.DOC_REPLACED],
    ]);
  });

  it('preserves publishing when the original document is not cached', async () => {
    documentManager.isDocInMemory.mockReturnValue(false);
    expect(await request()).toEqual({ status: 200, body: { success: true } });
    expect(documentManager.removeDocFromMemory).toHaveBeenCalledWith(draftUuid);
    expect(documentManager.reloadDoc).not.toHaveBeenCalled();
    expect(ioHelper.sendMessageToAllInRoom.mock.calls).toEqual([[draftUuid, MESSAGE.DOC_PUBLISHED]]);
  });

  it.each([
    { file_uuid: draftUuid },
    { file_uuid: draftUuid, origin_doc_uuid: otherUuid },
    { file_uuid: otherUuid, origin_doc_uuid: originUuid },
    { origin_doc_uuid: originUuid },
  ])('rejects missing or mismatched document bindings: %p', async payload => {
    expectDenied(await request(payload));
  });

  it('rejects a substituted original document in the request body', async () => {
    expectDenied(await request(publishClaims, { data: { ...publishBody, origin_doc_uuid: otherUuid } }));
  });

  it('rejects a token replayed against another draft', async () => {
    expectDenied(await request(publishClaims, { path: `/api/v1/docs/${otherUuid}/publish/` }));
  });

  it.each([undefined, null, '', 123, [], {}])('rejects an invalid origin_doc_uuid in the token: %p', async value => {
    expectDenied(await request({ ...publishClaims, origin_doc_uuid: value }));
  });

  it.each([undefined, null, '', 123, [], {}])('rejects an invalid origin_doc_uuid in the request body: %p', async value => {
    expectDenied(await request(publishClaims, { data: { ...publishBody, origin_doc_uuid: value } }));
  });

  it.each(['', 123])('rejects matching invalid origin_doc_uuid values: %p', async value => {
    expectDenied(await request({ ...publishClaims, origin_doc_uuid: value }, {
      data: { ...publishBody, origin_doc_uuid: value },
    }));
  });

  it('rejects an empty request body', async () => {
    expectDenied(await request(publishClaims, { body: '', headers: {} }));
  });

  it.each([
    { token: null },
    { token: 'invalid-token' },
    { signOptions: { expiresIn: -1 } },
    { signOptions: { algorithm: 'HS384' } },
  ])('rejects missing, invalid, expired or unsupported publish tokens: %p', async options => {
    expectDenied(await request(publishClaims, options));
  });

  it.each([true, false])('checks the original document binding after multipart parsing (matching: %s)', async matching => {
    const form = new FormData();
    form.append('origin_doc_uuid', matching ? originUuid : otherUuid);
    form.append('origin_doc_name', publishBody.origin_doc_name);
    const response = await request(publishClaims, { body: form.getBuffer(), headers: form.getHeaders() });
    if (matching) {
      expect(response).toEqual({ status: 200, body: { success: true } });
      expect(documentManager.reloadDoc).toHaveBeenCalledWith(originUuid, publishBody.origin_doc_name);
    } else {
      expectDenied(response);
    }
  });
});
