const OPERATION_RESULT_CACHE_TIMEOUT = 10 * 60 * 1000;
const MAX_OPERATION_RESULT_COUNT = 1000;

class ExcalidrawDocument {

  constructor(exdrawUuid, exdrawName, exdrawContent) {
    this.exdrawUuid = exdrawUuid;
    this.exdrawName = exdrawName;
    this.elements = exdrawContent.elements;
    this.version = exdrawContent.version;
    this.last_modify_user = exdrawContent.last_modify_user;
    this.operationResults = new Map();
    this.meta = {
      save_times: 0,
      need_save: false,
      is_saving: false,
      last_access: new Date().getTime(),
      last_save_time: '',
      owner: '',
    };
  }

  setValue = (elements, version) => {
    let last_access = new Date().getTime();
    this.elements = elements;
    this.version = version;
    let need_save = true;
    this.setMeta({last_access, need_save});
  };

  setMeta = (meta) => {
    this.meta = {...this.meta, ...meta};
  };

  getOperationResult = (operationId) => {
    const operation = this.operationResults.get(operationId);
    if (!operation) {
      return null;
    }

    if (Date.now() - operation.createdAt > OPERATION_RESULT_CACHE_TIMEOUT) {
      this.operationResults.delete(operationId);
      return null;
    }

    return operation.result;
  };

  setOperationResult = (operationId, result) => {
    this.operationResults.set(operationId, {
      createdAt: Date.now(),
      result,
    });

    while (this.operationResults.size > MAX_OPERATION_RESULT_COUNT) {
      const oldestOperationId = this.operationResults.keys().next().value;
      this.operationResults.delete(oldestOperationId);
    }
  };

  getMeta = () => {
    return this.meta;
  };

  toJson = () => {
    this.setMeta({last_access: new Date().getTime()});
    return {
      elements: this.elements,
      version: this.version,
      last_modify_user: this.last_modify_user
    };
  };

  setLastModifyUser = (user = { username: '' }) => {
    this.last_modify_user = user.username || '';
  };
}

export default ExcalidrawDocument;
