import { OPERATIONS_CACHE_LIMIT } from '../constants';
import DBHelper from '../db-helper';
import logger from "../loggers";

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

  addOperations = (docUuid, operations) => {
    let operationList = this.operationListMap.get(docUuid) || [];
    operationList.push(operations);
    if (operationList.length >= OPERATIONS_CACHE_LIMIT) {
      operationList = operationList.slice(OPERATIONS_CACHE_LIMIT / 10);
    }
    this.operationListMap.set(docUuid, operationList);
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

  recordOperations(docUuid, operations, version, user) {
    let sql = 'INSERT INTO `operation_log` \
      (doc_uuid, op_id, op_time, operations, author, app) VALUES (?, ?, ?, ?, ?, ?)';
    let values = [docUuid, version, Date.now(), JSON.stringify(operations), user.username, null];
    DBHelper(sql, (err, results) => {
      if (err) {
        logger.error(err);
        throw new Error('Database error.');
      }
      if (results) {
        logger.debug('Success record operation log to database.');
      }
    }, values);
  }

}

export default OperationsManager;
