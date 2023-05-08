import { OPERATIONS_CACHE_LIMIT } from '../constants';
import { recordOperations } from '../dao/operation-log';

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

  addOperations = (docUuid, operations, version, user) => {
    let operationList = this.operationListMap.get(docUuid) || [];
    let item = {operations, version};
    operationList.push(item);
    if (operationList.length >= OPERATIONS_CACHE_LIMIT) {
      operationList = operationList.slice(OPERATIONS_CACHE_LIMIT / 10);
    }
    this.operationListMap.set(docUuid, operationList);
    // Save current operations into database
    recordOperations(docUuid, operations, version, user);
  };

  getLoseOperationList = (docUuid, version) => {
    const operationList = this.operationListMap.get(docUuid) || [];
    if (operationList.length === 0) return [];
    return operationList.filter(item => item.version > version);
  };

  getOperationsSize = (docUuid) => {
    const operationList = this.operationListMap.get(docUuid);
    return operationList.length;
  };

  clearOperations = (docUuid) => {
    this.operationListMap.delete(docUuid);
  };

}

export default OperationsManager;
