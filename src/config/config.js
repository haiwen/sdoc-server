import fs from 'fs';

let db_host = 'localhost';
let db_user = '';
let db_password = '';
let db_database = '';
let db_port = 3306;
let connection_limit = 5;

let server_port = 7070;

let save_interval = 5 * 60 * 1000; // 5 min

let private_key;

let seahub_service_url = 'http://127.0.0.1:80';


// config in file
export function loadJsonFile(file) {
  var json = fs.readFileSync(file).toString();
  return JSON.parse(json);
}

const filePath = process.env.SDOC_SERVER_CONFIG; // sdoc_server_config.json

if (filePath && fs.existsSync(filePath)) {
  const config = loadJsonFile(filePath);

  db_host = config.host || db_host;
  db_user = config.user || db_user;
  db_password = config.password || db_password;
  db_database = config.database || db_database;
  db_port = config.port || db_port;
  connection_limit = config.connection_limit || connection_limit;

  server_port = config.server_port || server_port;

  save_interval = config.save_interval || save_interval;

  private_key = config.private_key || private_key;

  seahub_service_url = config.seahub_service_url || seahub_service_url;
}


// config in env
export const MYSQL_CONFIG = {
  host: process.env.DB_HOST || db_host,
  user: process.env.DB_USER || db_user,
  password: process.env.DB_PASSWORD || db_password,
  database: process.env.DB_NAME || db_database,
  port: Number(process.env.DB_PORT || db_port),
  connectionLimit: Number(process.env.CONNECTION_LIMIT || connection_limit),
};

export const SERVER_PORT = Number(process.env.SERVER_PORT || server_port);

export const SAVE_INTERVAL = Number(process.env.SAVE_INTERVAL || save_interval);

export const SEADOC_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY || private_key;

export const SEAHUB_SERVER = process.env.SEAHUB_SERVICE_URL || seahub_service_url;
