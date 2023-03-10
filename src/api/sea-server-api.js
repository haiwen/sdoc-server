import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import { SEAHUB_SERVER } from '../config/config';
import { getDirPath } from '../utils';

class SeaServerAPI {

  getConfig = (token) => {
    const config = {
      baseURL: SEAHUB_SERVER,
      headers: { 'Authorization': 'Token ' + token },
    };
    return config;
  };

  getFileDownloadLink = (token, repoID, filePath) => {
    const config = this.getConfig(token);
    const path = encodeURIComponent(filePath);
    const url = '/api2/repos/' + repoID + '/file/?p=' + path + '&reuse=1';
    return axios.get(url, config);
  };

  getFileUpdateLink = (token, repoID, dirPath) => {
    const config = this.getConfig(token);
    const url = '/api2/repos/' + repoID + '/update-link/?p=' + encodeURIComponent(dirPath);
    return axios.get(url, config);
  };

  getFileContent = (token, repoID, filePath) => {
    return this.getFileDownloadLink(token, repoID, filePath).then(res => {
      const downloadLink = res.data;
      return axios.get(downloadLink);
    });
  };
    
  saveFileContent = (token, repoID, filePath, fileName, fileData) => {    
    const dirPath = getDirPath(filePath);
    return this.getFileUpdateLink(token, repoID, dirPath).then(res => {

      const uploadLink = res.data;
      const formData = new FormData();
      formData.append("target_file", filePath);
      formData.append("filename", fileName);
      formData.append("file", fs.createReadStream(fileData.path), {fileName: fileName});
      return (
        axios.create()({
          method: 'post',
          url: uploadLink,
          data: formData,
        })
      );
    });
  };

}

const seaServerAPI = new SeaServerAPI;

export default seaServerAPI;
