import { OPERATIONS_CACHE_LIMIT } from '../constants';

class OperationsManager {

  constructor() {
    this.instance = null;
    this.operationListMap = new Map();
  }

  static getInstance = () => {
    if (!this.instance) {
      this.instance = new OperationsManager();
    }

    return this.instance;
  };

  addOperations = (fileUUid, operations) => {
    let operationList = this.operationListMap.get(fileUUid) || [];
    operationList.push(operations);
    if (operationList.length >= OPERATIONS_CACHE_LIMIT) {
      operationList = operationList.slice(OPERATIONS_CACHE_LIMIT / 10);
    }
    this.operationListMap.set(fileUUid, operationList);
  };

  getLoseOperationList = (fileUuid, version) => {
    const operationList = this.operationListMap.get(fileUuid) || [];
    if (operationList.length === 0) return [];
    return operationList.filter(item => item.version > version);
  };

  getOperationsSize = (fileUuid) => {
    const operationList = this.operationListMap.get(fileUuid);
    return operationList.length;
  };

  clearOperations = (fileUuid) => {
    this.operationListMap.delete(fileUuid);
  };

}

export default OperationsManager;
