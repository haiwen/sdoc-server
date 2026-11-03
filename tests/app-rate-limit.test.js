jest.mock('../src/config/config', () => ({
  ...jest.requireActual('../src/config/config'),
  RATE_LIMIT_MAX: 2,
  RATE_LIMIT_WINDOW_MS: 60000,
}));

import http from 'http';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import rateLimiter from '../src/middleware/rate-limit';

const request = (server, path = '/ping', { method = 'GET', body = '', headers = {} } = {}) => new Promise((resolve, reject) => {
  const req = http.request({
    hostname: '127.0.0.1',
    port: server.address().port,
    path,
    method,
    headers: { 'Content-Length': Buffer.byteLength(body), ...headers },
  }, res => {
    let responseBody = '';
    res.setEncoding('utf8');
    res.on('data', chunk => { responseBody += chunk; });
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: responseBody }));
  });
  req.on('error', reject);
  req.end(body);
});

describe('HTTP request rate limit', () => {
  let server;
  let originalTrustProxy;

  beforeAll(done => {
    originalTrustProxy = app.get('trust proxy');
    server = app.listen(0, '127.0.0.1', done);
  });

  beforeEach(async () => {
    app.set('trust proxy', false);
    await Promise.all(['127.0.0.1', '192.0.2.1', '192.0.2.2'].map(ip => rateLimiter.resetKey(ip)));
  });

  afterEach(() => {
    app.set('trust proxy', originalTrustProxy);
    jest.restoreAllMocks();
  });

  afterAll(done => {
    server.close(done);
  });

  it('allows requests up to the limit, then returns 429 with CORS and retry headers', async () => {
    expect((await request(server)).body).toBe('pong');
    expect((await request(server)).status).toBe(200);

    const response = await request(server);

    expect(response.status).toBe(429);
    expect(JSON.parse(response.body)).toEqual({ error_code: 'rate_limit_exceeded' });
    expect(response.headers['access-control-allow-origin']).toBe('*');
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
    expect(response.headers['ratelimit-policy']).toBe('2;w=60');
    expect(response.headers.ratelimit).toContain('remaining=0');
  });

  it('rejects excessive requests before invoking JWT authentication', async () => {
    const verify = jest.spyOn(jwt, 'verify');
    const options = { headers: { Authorization: 'Bearer invalid-token' } };

    expect((await request(server, '/api/v1/docs/doc-1/', options)).status).toBe(403);
    expect((await request(server, '/api/v1/docs/doc-1/', options)).status).toBe(403);
    expect((await request(server, '/api/v1/docs/doc-1/', options)).status).toBe(429);
    expect(verify).toHaveBeenCalledTimes(2);
  });

  it.each(['/api/v1/docs/doc-1/element-commands', '/api/v1/docs/doc-1/'])('limits %s before JSON body parsing', async path => {
    await request(server);
    await request(server);

    const response = await request(server, path, {
      method: 'POST', body: '{"invalid":', headers: { 'Content-Type': 'application/json' },
    });

    expect(response.status).toBe(429);
    expect(JSON.parse(response.body)).toEqual({ error_code: 'rate_limit_exceeded' });
  });

  it('does not charge CORS preflight requests against the limit', async () => {
    for (let count = 0; count < 3; count++) {
      expect((await request(server, '/api/v1/docs/doc-1/', { method: 'OPTIONS' })).status).toBe(200);
    }
    expect((await request(server)).status).toBe(200);
    expect((await request(server)).status).toBe(200);
    expect((await request(server)).status).toBe(429);
  });

  it('uses separate client limits when forwarding headers come from a trusted proxy', async () => {
    app.set('trust proxy', 'loopback');
    const firstClient = { headers: { 'X-Forwarded-For': '192.0.2.1' } };
    const secondClient = { headers: { 'X-Forwarded-For': '192.0.2.2' } };

    expect((await request(server, '/ping', firstClient)).status).toBe(200);
    expect((await request(server, '/ping', firstClient)).status).toBe(200);
    expect((await request(server, '/ping', firstClient)).status).toBe(429);
    expect((await request(server, '/ping', secondClient)).status).toBe(200);
  });

  it('ignores spoofed forwarding headers from an untrusted peer', async () => {
    app.set('trust proxy', '192.0.2.0/24');

    expect((await request(server, '/ping', { headers: { 'X-Forwarded-For': '192.0.2.1' } })).status).toBe(200);
    expect((await request(server, '/ping', { headers: { 'X-Forwarded-For': '192.0.2.2' } })).status).toBe(200);
    expect((await request(server, '/ping', { headers: { 'X-Forwarded-For': '192.0.2.3' } })).status).toBe(429);
  });
});
