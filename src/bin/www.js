import http from 'http';
import { SERVER_PORT } from '../config/config';
import logger from '../loggers';
import app from "../app";

const server = http.createServer(app);

server.listen(SERVER_PORT, () => {
  console.log("server is serve on http://127.0.0.1:" + SERVER_PORT);
});

process.on('unhandledRejection', (reason, p) => {
  logger.error(reason && (reason.stack || reason), 'Unhandled Rejection at Promise', p)
});

process.on('uncaughtException', (err, origin) => {
  logger.error(err, origin);
});