import fs from 'fs';
import { v4 } from "uuid";

// 生成默认的文本对象
export const generateDefaultText = () => {
  return { id: v4(), text: '' };
};

// 生成默认的 doc 文件内容
export const generateDefaultDocContent = () => {
  const defaultValue = {
    version: 0,
    children: [
      {id: v4(), type: 'header1', children: [generateDefaultText()]},
      {id: v4(), type: 'paragraph', children: [generateDefaultText()]}
    ]
  };
  return defaultValue;
};

// 获取目录路径
export const getDirPath = (path) => {
  let dir = path.slice(0, path.lastIndexOf('/'));
  if (dir === '') {
    return '/';
  } else {
    return dir;
  }
};

// 删除本地目录
export const deleteDir = (path) => {
  // 验证目录是否存在，如果存在子目录，深度优先递归删除目录
  if (fs.existsSync(path)) {
    const info = fs.statSync(path);
    // 子节点是目录
    if (info.isDirectory()) {
      const data = fs.readdirSync(path);
      if (data.length > 0) {
        // 遍历目录
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
      // 子节点是文件，直接删除文件
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

// 时间转换成毫秒
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

// 从 URL 中获取 doc 的 UUID
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

// 判断错误是否超时
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

