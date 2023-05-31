import log4js from 'log4js';
import path from 'path';

// 默认存储路径
let logFile = './sdoc-server.log';

// 如果配置日志目录，使用新的目录
if (process.env.LOG_DIR) {
  logFile = path.join(process.env.LOG_DIR, 'sdoc-server.log');
}
// 设置日志等级
const logLevel = process.env.SDOC_SERVER_LOG_LEVEL || 'info';

// const commonLayout = {
//   type: 'pattern',
//   pattern: '[%d{yyyy-MM-dd hh:mm:ss}] [%p] %c - %m',
// };

// 日志格式
const codeLayout = {
  type: 'pattern',
  pattern: '[%d{yyyy-MM-dd hh:mm:ss}] [%p] %f{1}[%l] - %m',
};

// 日志设置
log4js.configure({
  appenders: { 
    logger: { 
      type: 'dateFile', 
      filename: logFile,
      pattern: "yyyy-MM-dd",
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
