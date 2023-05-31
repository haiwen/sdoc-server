import DBHelper from "../db-helper";

// 记录操作 数据库中插入操作日志
export const recordOperations = (docUuid, operations, version, user) => {
  const sql = 'INSERT INTO `operation_log` \
    (doc_uuid, op_id, op_time, operations, author) VALUES (?, ?, ?, ?, ?)';
  const values = [docUuid, version, Date.now(), JSON.stringify(operations), user.username];
  return DBHelper(sql, values);
};

// 列出某个文档中悬挂的操作（数据库中查找相关OP）
export const listPendingOperationsByDoc = (docUuid, version) => {
  const sql = `SELECT operations, op_id, author FROM operation_log WHERE \
    doc_uuid='${docUuid}' AND op_id>${version} ORDER BY op_id`;
  return DBHelper(sql);
};
