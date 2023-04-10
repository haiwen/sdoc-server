import { OPERATIONS_CACHE_LIMIT } from '../constants';

class OperationsManager {

  constructor() {
    this.instance = null;
    this.filesMap = new Map();
  }

  static getInstance = () => {
    if (!this.instance) {
      this.instance = new OperationsManager();
    }

    return this.instance;
  };

  addOperations = (fileUUid, operations) => {
    let operationList = this.filesMap.get(fileUUid) || [];
    operationList.push(operations);
    if (operationList.length >= OPERATIONS_CACHE_LIMIT) {
      operationList = operationList.slice(OPERATIONS_CACHE_LIMIT / 10);
    }
    this.filesMap.set(fileUUid, operationList);
  };

  getLoseOperationList = (fileUuid, version) => {
    const operationList = this.filesMap.get(fileUuid) || [];
    if (operationList.length === 0) return [];
    return operationList.filter(item => item.version > version);
  };

  getOperationsSize = (fileUuid) => {
    const operationList = this.filesMap.get(fileUuid);
    return operationList.length;
  };

  clearOperations = (fileUuid) => {
    this.filesMap.delete(fileUuid);
  };

}

export default OperationsManager;
