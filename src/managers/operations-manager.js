import { OPERATIONS_CACHE_LIMIT } from '../constants';
import { recordOperations } from '../dao/operation-log';

class OperationsManager {

  constructor() {
    this.instance = null;
    this.operationListMap = new Map();
  }

  // 获取实例
  static getInstance = () => {
    if (!this.instance) {
      this.instance = new OperationsManager();
    }

    return this.instance;
  };

  // 增加多个操作
  addOperations = (docUuid, operations, version, user) => {
    // 找到这个文档的操作记录列表
    let operationList = this.operationListMap.get(docUuid) || [];
    let item = {operations, version};
    // 把操作记录和版本号写入
    operationList.push(item);
    // 如果大于缓存限制 1000，那么剪切一部分？——为什么这样处理呢？这样会丢失一部分操作，应该是循环写入，或者是函数递归调用增加操作，可能处于性能考虑
    // 数据库中直接写入全部的操作，然后操作管理器中，只存储最新的大部分操作
    if (operationList.length >= OPERATIONS_CACHE_LIMIT) {
      operationList = operationList.slice(OPERATIONS_CACHE_LIMIT / 10);
    }
    // 设置当前的操作日志
    this.operationListMap.set(docUuid, operationList);
    // 把当前操作写入数据库
    // Save current operations into database
    recordOperations(docUuid, operations, version, user);
  };

  // 获取丢失的操作列表
  getLoseOperationList = (docUuid, version) => {
    const operationList = this.operationListMap.get(docUuid) || [];
    if (operationList.length === 0) return [];
    // 返回服务器上版本大于某个版本的操作记录，这就是客户端相对服务器丢失的操作列表
    return operationList.filter(item => item.version > version);
  };

  // 获取某个 doc 的操作日志长度
  getOperationsSize = (docUuid) => {
    const operationList = this.operationListMap.get(docUuid);
    return operationList.length;
  };

  // 清空某个 doc 的操作日志
  clearOperations = (docUuid) => {
    this.operationListMap.delete(docUuid);
  };

}

export default OperationsManager;
