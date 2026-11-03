import fs from 'fs';
import os from 'os';
import path from 'path';

const configEnvNames = ['SDOC_SERVER_CONFIG', 'RATE_LIMIT_MAX', 'RATE_LIMIT_WINDOW_MS', 'TRUST_PROXY'];
const originalEnv = {};

const loadConfig = () => {
  let config;
  jest.isolateModules(() => { config = require('../../src/config/config'); });
  return config;
};

describe('HTTP rate limit configuration', () => {
  let tempDir;
  let configPath;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdoc-rate-config-'));
    configPath = path.join(tempDir, 'config.json');
  });

  beforeEach(() => {
    configEnvNames.forEach(name => {
      originalEnv[name] = process.env[name];
      delete process.env[name];
    });
    fs.writeFileSync(configPath, '{}');
  });

  afterEach(() => {
    configEnvNames.forEach(name => {
      if (originalEnv[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = originalEnv[name];
      }
    });
  });

  afterAll(() => {
    fs.unlinkSync(configPath);
    fs.rmdirSync(tempDir);
  });

  it('defaults to 600 requests per minute without trusting proxy headers', () => {
    expect(loadConfig()).toMatchObject({ RATE_LIMIT_MAX: 600, RATE_LIMIT_WINDOW_MS: 60000, TRUST_PROXY: false });
  });

  it('loads limits and trusted proxies from the JSON file', () => {
    fs.writeFileSync(configPath, JSON.stringify({ rate_limit_max: 20, rate_limit_window_ms: 10000, trust_proxy: 'loopback' }));
    process.env.SDOC_SERVER_CONFIG = configPath;

    expect(loadConfig()).toMatchObject({ RATE_LIMIT_MAX: 20, RATE_LIMIT_WINDOW_MS: 10000, TRUST_PROXY: 'loopback' });
  });

  it('allows environment variables to override the JSON file', () => {
    fs.writeFileSync(configPath, JSON.stringify({ rate_limit_max: 20, rate_limit_window_ms: 10000, trust_proxy: 'loopback' }));
    process.env.SDOC_SERVER_CONFIG = configPath;
    process.env.RATE_LIMIT_MAX = '40';
    process.env.RATE_LIMIT_WINDOW_MS = '20000';
    process.env.TRUST_PROXY = '192.0.2.0/24';

    expect(loadConfig()).toMatchObject({ RATE_LIMIT_MAX: 40, RATE_LIMIT_WINDOW_MS: 20000, TRUST_PROXY: '192.0.2.0/24' });
  });

  it.each(['0', '-1', 'NaN', '', '1.5'])('rejects an invalid request count: %p', value => {
    process.env.RATE_LIMIT_MAX = value;
    expect(loadConfig).toThrow('RATE_LIMIT_MAX must be a positive integer');
  });

  it.each(['0', '-1', 'NaN', '', '1.5', '2147483648'])('rejects an invalid time window: %p', value => {
    process.env.RATE_LIMIT_WINDOW_MS = value;
    expect(loadConfig).toThrow('RATE_LIMIT_WINDOW_MS must be an integer between 1 and 2147483647');
  });

  it('rejects a zero value from JSON instead of silently using the default', () => {
    fs.writeFileSync(configPath, JSON.stringify({ rate_limit_max: 0 }));
    process.env.SDOC_SERVER_CONFIG = configPath;

    expect(loadConfig).toThrow('RATE_LIMIT_MAX must be a positive integer');
  });
});
