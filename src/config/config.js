import fs from 'fs';

export function loadJsonFile(file) {
  var json = fs.readFileSync(file).toString();
  return JSON.parse(json);
}

const filePath = process.env.SDOC_SERVER_CONFIG; // sdoc_server_config.json

const config = loadJsonFile(filePath);

export const MYSQL_CONFIG = {
  host: config.host,
  user: config.user,
  password: config.password,
  database: config.database,
  port: config.port,
  connectionLimit: config.connection_limit,
};

export const SEAHUB_SERVER = config.seahub_service_url || 'http://127.0.0.1:80';

export const SERVER_PORT = config.server_port || 7070;

export const SAVE_INTERVAL = config.save_interval || 5 * 60 * 1000; // 5 min

export const SEADOC_PRIVATE_KEY = config.private_key;
