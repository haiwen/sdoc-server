import { OPERATIONS_CACHE_LIMIT } from '../constants';
import { listPendingOperationsByDoc, recordOperations, queryOperationCount } from '../dao/operation-log';

class OperationsManager {

  constructor() {
    this.instance = null;
    this.operationCountSinceUp = 0;
    this.operationListMap = new Map();
  }

  static getInstance = () => {
    if (!this.instance) {
      this.instance = new OperationsManager();
    }

    return this.instance;
  };

  addOperations = async (docUuid, operations, version, user) => {
    // Save current operations into database
    await recordOperations(docUuid, operations, version, user);
    this.operationCountSinceUp++;

    // Record current operations into memory
    let operationList = this.operationListMap.get(docUuid) || [];
    let item = {operations, version};
    operationList.push(item);
    if (operationList.length >= OPERATIONS_CACHE_LIMIT) {
      operationList = operationList.slice(OPERATIONS_CACHE_LIMIT / 10);
    }
    this.operationListMap.set(docUuid, operationList);
  };

  getLoseOperationList = async (docUuid, version) => {
    let operationList = this.operationListMap.get(docUuid);
    if (operationList) {
      if (operationList.length === 0) return [];
      return operationList.filter(item => item.version > version);
    }
    // operationList is not exist load it from database
    operationList = await listPendingOperationsByDoc(docUuid, version);
    // format query result
    operationList = JSON.parse(JSON.stringify(operationList));
    // add version filed for operation
    operationList = operationList.map(item => {
      item.version = item.op_id;
      return item;
    });
    return operationList.filter(item => item.version > version);
  };

  getOperationsSize = (docUuid) => {
    const operationList = this.operationListMap.get(docUuid);
    return operationList.length;
  };

  clearOperations = (docUuid) => {
    this.operationListMap.delete(docUuid);
  };

  getOperationCount = async (interval) => {
    let count = await queryOperationCount(interval);
    return count[0].count;
  };

}

export default OperationsManager;
