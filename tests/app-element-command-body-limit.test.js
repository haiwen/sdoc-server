import http from 'http';
import app from '../src/app';
import { BASE_URL_VERSION1, ELEMENT_COMMAND_LIMITS } from '../src/modules/sdoc/constants';

const postJson = (server, path, body, headers = {}) => new Promise((resolve, reject) => {
  const address = server.address();
  const request = http.request({
    hostname: '127.0.0.1',
    port: address.port,
    path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      ...headers,
    },
  }, response => {
    let responseBody = '';
    response.setEncoding('utf8');
    response.on('data', chunk => {
      responseBody += chunk;
    });
    response.on('end', () => {
      resolve({ status: response.statusCode, body: responseBody });
    });
  });
  request.on('error', reject);
  request.end(body);
});

describe('Element Command request body limit', () => {
  let server;

  beforeAll(done => {
    server = app.listen(0, '127.0.0.1', done);
  });

  afterAll(done => {
    server.close(done);
  });

  it('rejects an oversized JSON body with a stable 413 response', async () => {
    const body = JSON.stringify({ padding: 'x'.repeat(ELEMENT_COMMAND_LIMITS.MAX_REQUEST_BYTES) });

    const response = await postJson(server, `${BASE_URL_VERSION1}/doc-1/element-commands`, body);

    expect(response.status).toBe(413);
    expect(JSON.parse(response.body)).toEqual({
      error_code: 'batch_limit_exceeded',
    });
  });

  it('rejects malformed JSON with a stable 400 response', async () => {
    const response = await postJson(server, `${BASE_URL_VERSION1}/doc-1/element-commands`, '{"commands":');

    expect(response.status).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      error_code: 'invalid_request',
    });
  });

  it('passes a body under the route limit to the existing auth middleware', async () => {
    const body = JSON.stringify({ commands: [] });

    const response = await postJson(server, `${BASE_URL_VERSION1}/doc-1/element-commands`, body);

    expect(response.status).toBe(403);
    expect(JSON.parse(response.body)).toEqual({ error_code: 'permission_denied' });
  });

  it('returns the route-specific permission error for an invalid token', async () => {
    const body = JSON.stringify({ commands: [] });

    const response = await postJson(server, `${BASE_URL_VERSION1}/doc-1/element-commands`, body, {
      Authorization: 'Bearer invalid-token',
    });

    expect(response.status).toBe(403);
    expect(JSON.parse(response.body)).toEqual({ error_code: 'permission_denied' });
  });

  it.each([
    [`${BASE_URL_VERSION1}/doc-1/element-commands?source=test`, { error_code: 'permission_denied' }],
    [`${BASE_URL_VERSION1}/doc-1/element-commands/`, { error_code: 'permission_denied' }],
    ['/api/v1/files/doc-1/element-commands', { error_msg: 'You don\'t have permission to access.' }],
    [`${BASE_URL_VERSION1}/doc-1/`, { error_msg: 'You don\'t have permission to access.' }],
  ])('uses the expected authentication error for %s', async (path, expectedBody) => {
    const response = await postJson(server, path, JSON.stringify({ commands: [] }));

    expect(response.status).toBe(403);
    expect(JSON.parse(response.body)).toEqual(expectedBody);
  });

});
