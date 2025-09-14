import log4js from 'log4js';
import path from 'path';

let logFile = './sdoc-server.log';
let requestTimeFile = './sdoc-access.log';
let slowRequestTimeFile = './sdoc-access-slow.log';
let socketTimeFile = './sdoc-socket.log';
let slowSocketTimeFile = './sdoc-socket-slow.log';

if (process.env.LOG_DIR) {
  logFile = path.join(process.env.LOG_DIR, 'sdoc-server.log');
  requestTimeFile = path.join(process.env.LOG_DIR, 'sdoc-access.log');
  slowRequestTimeFile = path.join(process.env.LOG_DIR, 'sdoc-access-slow.log');
  socketTimeFile = path.join(process.env.LOG_DIR, 'sdoc-socket.log');
  slowSocketTimeFile = path.join(process.env.LOG_DIR, 'sdoc-socket-slow.log');
}
const logLevel = process.env.SDOC_SERVER_LOG_LEVEL || 'info';

const commonLayout = {
  type: 'pattern',
  pattern: '[%d{yyyy-MM-dd hh:mm:ss}] [%p] %c - %m',
};

const codeLayout = {
  type: 'pattern',
  pattern: '[%d{yyyy-MM-dd hh:mm:ss}] [%p] %f{1}[%l] - %m',
};

log4js.configure({
  appenders: {
    logger: {
      type: 'dateFile',
      filename: logFile,
      pattern: "yyyy-MM-dd",
      keepFileExt: true,
      layout: codeLayout,
    },
    requestTime: {
      type: "dateFile",
      filename: requestTimeFile,
      pattern: "yyyy-MM-dd",
      keepFileExt: true,
      layout: commonLayout,
    },
    slowRequestTime: {
      type: "dateFile",
      filename: slowRequestTimeFile,
      pattern: "yyyy-MM-dd",
      keepFileExt: true,
      layout: commonLayout,
    },
    socketTime: {
      type: "dateFile",
      filename: socketTimeFile,
      pattern: "yyyy-MM-dd",
      keepFileExt: true,
      layout: commonLayout,
    },
    slowSocketTime: {
      type: "dateFile",
      filename: slowSocketTimeFile,
      pattern: "yyyy-MM-dd",
      keepFileExt: true,
      layout: commonLayout,
    }
  },
  categories: {
    default: {
      appenders: ['logger'],
      level: logLevel,
      enableCallStack: true,
    },
    requestTime: {
      appenders: ['requestTime'],
      level: logLevel
    },
    slowRequestTime: {
      appenders: ['slowRequestTime'],
      level: logLevel
    },
    socketTime: {
      appenders: ['socketTime'],
      level: logLevel
    },
    slowSocketTime: {
      appenders: ['slowSocketTime'],
      level: logLevel
    }
  }
});

const logger = log4js.getLogger('default');
const requestTimeLogger = log4js.getLogger('requestTime');
const slowRequestTimeLogger = log4js.getLogger('slowRequestTime');
const socketTime = log4js.getLogger('socketTime');
const slowSocketTime = log4js.getLogger('slowSocketTime');

export default logger;
export { requestTimeLogger, slowRequestTimeLogger, socketTime, slowSocketTime };
