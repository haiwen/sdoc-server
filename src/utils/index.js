import fs from 'fs';
import { v4 } from "uuid";

export const generateDefaultText = (text = '') => {
  return { id: v4(), text };
};

export const generateDefaultDocContent = (docName) => {
  const headerText = docName ? docName.split('.')[0] : '';
  const defaultValue = {
    version: 0,
    children: [
      {id: v4(), type: 'title', children: [generateDefaultText(headerText)]},
      {id: v4(), type: 'paragraph', children: [generateDefaultText()]}
    ]
  };
  return defaultValue;
};

export const isSdocContentValid = (content) => {
  if (!content['children'] || (!content['version'] && content['version'] !== 0)) {
    return false;
  }
  if (!Array.isArray(content['children'])) {
    return false;
  }
  return true;
};

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

/**
 * delete current user's cursor from returned value
 * @param {*} docContent 
 * @param {*} username 
 * @returns 
 */
export function formatDocContent(docContent, username) {
    const { cursors = {}  } = docContent;
    if (cursors[username]) {
      delete cursors[username];
      docContent.cursors = cursors;
      return docContent;
    }
    return docContent;
}

