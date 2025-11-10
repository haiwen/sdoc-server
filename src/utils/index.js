import fs from 'fs';
import logger from '../loggers';

export const getDirPath = (path) => {
  let dir = path.slice(0, path.lastIndexOf('/'));
  if (dir === '') {
    return '/';
  } else {
    return dir;
  }
};

export const deleteDir = (path) => {
  if (fs.existsSync(path)) {
    const info = fs.statSync(path);
    if (info.isDirectory()) {
      const data = fs.readdirSync(path);
      if (data.length > 0) {
        for (var i = 0; i < data.length; i++) {
          deleteDir(`${path}/${data[i]}`);
          if (i == data.length - 1) {
            deleteDir(`${path}`);
          }
        }
      } else {
        fs.rmdirSync(path);
      }
    } else if (info.isFile()) {
      fs.unlinkSync(path);
    }
  }
};

export const TIME_TYPE = {
  's': 's',
  'second': 's',
  'm': 'm',
  'min': 'm',
  'minute': 'm',
  'h': 'h',
  'hour': 'h',
};

export const formatTimeToMillisecond = (time) => {
  if (!time) return null;
  if (time.length <= 1) return null;
  if (Number.isNaN(parseInt(time))) return null;

  const value = parseFloat(time);
  const type = time.slice((value + '').length);

  if (!TIME_TYPE[type]) return null;

  // hour | h
  if (type.indexOf('h') > -1) {
    return time = value * 60 * 60 * 1000;
  }

  // minute | min | m
  if (type.indexOf('m') > -1) {
    return time = value * 60 * 1000;
  }

  // second | s
  if (type.indexOf('s') > -1) {
    return time = value * 1000;
  }

};

export const getDocUuidFromUrl = (url) => {
  const pathname = url.split('?')[0];
  if (pathname.indexOf('/files/') === -1) {
    return null;
  }
  const docUuidPath = pathname.split('/files/')[1];
  const splitIndex = docUuidPath.indexOf('/');
  if (splitIndex > -1) {
    return docUuidPath.split('/')[0];
  }
  return docUuidPath;
};

export const isRequestTimeout = (err) => {
  if (err.code === 'ECONNABORTED' || err.message === 'Network Error' || err.message.includes('timeout')) {
    return true;
  }
  return false;
};

export const getErrorMessage = (err) => {
  let message = { status: 500, error_msg: `Internal Server Error` };
  if (err && err.response) {
    const { status, data } = err.response;
    message = { status, ...data };
  }
  return message;
};

export const isObject = (obj) => {
  if (!obj) return false;
  return Object.prototype.toString.call(obj) === '[object Object]';
};

export function uuidStrTo32Chars(uuid) {
  if(uuid.length === 36) {
    return uuid.split('-').join('');
  } else {
    return uuid;
  }
}

export function uuidStrTo36Chars(uuid) {
  if(uuid.length === 32) {
    let uuid_array = uuid.split('');
    uuid_array.splice(20, 0, '-');
    uuid_array.splice(16, 0, '-');
    uuid_array.splice(12, 0, '-');
    uuid_array.splice(8, 0, '-');
    return uuid_array.join('');
  } else {
    return uuid;
  }
}

export const errorHandle = (error) => {
  if (error.code === 'ECONNREFUSED') {
    const message = 'Service connection refused';
    logger.error(message);
    logger.error('error_name: ', error.name);
    logger.error('error_message: ', error.message);
    logger.error('error_code: ', error.code);
    return;
  }

  if (error.code === 'ETIMEDOUT') {
    const message = 'Service request timeout';
    logger.error(message);
    logger.error('error_name: ', error.name);
    logger.error('error_message: ', error.message);
    logger.error('error_code: ', error.code);
    return;
  }

  if (error.response) {
    const { status } = error.response;

    if (status >= 400 && status < 500) {
      const message = 'Service client error';
      logger.error(message);
      logger.error('error_name: ', 'HttpClientError');
      logger.error('error_message: ', `HTTP ${status}: ${error.message}`);
      return;
    }

    if (status >= 500) {
      const message = 'Service server error';
      logger.error(message);
      logger.error('error_name: ', 'HttpServerError');
      logger.error('error_message: ', `HTTP ${status}: ${error.message}`);
      return;
    }
  }

  const message = 'Service unknown error';
  logger.error(message);
  logger.error('error_type: ', 'UNKNOWN_ERROR');
  logger.error('error_message: ', error.message);
  logger.error('error_stack: ', error.stack);
  return;
};

