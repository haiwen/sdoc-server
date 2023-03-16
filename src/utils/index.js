import fs from 'fs';

export const generateDefaultFileContent = () => {
  const defaultValue = {
    content: [{type: 'paragraph', children: [{ text: '' }]}]
  };
  return defaultValue;
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


