import log4js from 'log4js';
import path from 'path';

let logFile = './sdoc-server.log';

if (process.env.LOG_DIR) {
  logFile = path.join(process.env.LOG_DIR, 'sdoc-server.log');
}
const logLevel = process.env.DTABLE_SERVER_LOG_LEVEL || 'info';

// const commonLayout = {
//   type: 'pattern',
//   pattern: '[%d{yyyy-MM-dd hh:mm:ss}] [%p] %c - %m',
// };

const codeLayout = {
  type: 'pattern',
  pattern: '[%d{yyyy-MM-dd hh:mm:ss}] [%p] %f{1}[%l] - %m',
}

log4js.configure({
  appenders: { 
    logger: { 
      type: 'dateFile', 
      filename: logFile,
      pattern: ".yyyy-MM-dd", 
      keepFileExt: true,
      layout: codeLayout,
    },
  },
  categories: { 
    default: {  
      appenders: ['logger'], 
      level: logLevel,
      enableCallStack: true,
    },
  }
});

const logger = log4js.getLogger('default');

export default logger;
