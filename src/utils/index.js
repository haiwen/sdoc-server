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

export function deleteDir(path) {
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
}

