import fs from 'fs';

// 读取本地 JSON 配置文件
export function loadJsonFile(file) {
  var json = fs.readFileSync(file).toString();
  return JSON.parse(json);
}

const filePath = process.env.SDOC_SERVER_CONFIG; // sdoc_server_config.json

const config = loadJsonFile(filePath);

// MYSQL 配置
export const MYSQL_CONFIG = {
  host: config.host,
  user: config.user,
  password: config.password,
  database: config.database,
  port: config.port,
  connectionLimit: config.connection_limit,
};

// seahub 服务器地址
export const SEAHUB_SERVER = config.seahub_service_url || 'http://127.0.0.1:80';

// sdoc-server 服务器端口号
export const SERVER_PORT = config.server_port || 7070;

// 保存间隔
export const SAVE_INTERVAL = config.save_interval || 5 * 60 * 1000; // 5 min

// 私钥
export const SEADOC_PRIVATE_KEY = config.private_key;
