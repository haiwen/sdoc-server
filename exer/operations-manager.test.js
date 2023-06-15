const OPERATIONS_CACHE_LIMIT = 10;
const recordOperations = 1;

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
  }

  addOperations = (doc_uuid, operations, version, user) => 
  {
    let operationList = this.operationListMap.get(doc_uuid) || [];
    let item = {
      operations,
      version,
    };
    operationList.push(item);
    if (operationList.length >= OPERATIONS_CACHE_LIMIT) {
      operationList = operationList.slice(OPERATIONS_CACHE_LIMIT / 10);
    }
    this.operationListMap.set(doc_uuid, operationList);
    recordOperations(doc_uuid, operations, version, user);
  }

  getLoseOperationList = (doc_uuid, version) => {
    const operationList = this.operationListMap.get(doc_uuid);
    if (operationList.length === 0) {
      return [];
    }
    return operationList.filter(item => item.version > version);
  }

  getOperationSize = (doc_uuid) => {
    const operationList = this.operationListMap.get(doc_uuid);
    return operationList.length;
  }

  clearOperations = (doc_uuid) => {
    this.operationListMap.delete(doc_uuid);
  }
}

