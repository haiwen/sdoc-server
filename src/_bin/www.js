import http from 'http';
import io from 'socket.io';
import { SERVER_PORT } from '../config/config';
import logger from '../loggers';
import app from "../app";
import IOServer from '../wss';
import DocumentManager from '../managers/document-manager';

// 创建服务器
const server = http.createServer(app);

// 初始化 socket 链接（使用 express 服务器 + 允许跨域）——这里不太懂，应该是 socket 的固定配置
// init socket
const socketIO = io(server, {cors: true});
new IOServer(socketIO);

// 建立自动保存操作
// setup auto save operation
const documentManager = DocumentManager.getInstance();
documentManager.startSaveTimer();


logger.info('Starting sdoc server process:', process.pid);

// ws 服务器监听端口号
server.listen(SERVER_PORT, () => {
  // eslint-disable-next-line
  console.log("server is serve on http://127.0.0.1:" + SERVER_PORT);
});

// 处理事件并写入日志中
process.on('unhandledRejection', (reason, p) => {
  logger.error(reason && (reason.stack || reason), 'Unhandled Rejection at Promise', p);
});

process.on('uncaughtException', (err, origin) => {
  logger.error(err, origin);
});
