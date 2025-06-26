import http from 'http';
import io from 'socket.io';
import { SERVER_PORT } from '../config/config';
import logger from '../loggers';
import app from "../app";
import IOServer from '../wss';
import DocumentManager from '../modules/sdoc/managers/document-manager';
import ExcalidrawManager from '../modules/exdraw/managers/excalidraw-manager';

const server = http.createServer(app);

// init socket
const socketIO = io(server, {cors: true});
new IOServer(socketIO);

// setup auto save operation
const documentManager = DocumentManager.getInstance();
documentManager.startSaveTimer();

const exdrawManager = ExcalidrawManager.getInstance();
exdrawManager.startSaveTimer();


logger.info('Starting sdoc server process:', process.pid);
server.listen(SERVER_PORT, () => {
  // eslint-disable-next-line
  console.log("server is serve on http://127.0.0.1:" + SERVER_PORT);
});

process.on('unhandledRejection', (reason, p) => {
  logger.error(reason && (reason.stack || reason), 'Unhandled Rejection at Promise', p);
});

process.on('uncaughtException', (err, origin) => {
  logger.error(err, origin);
});
