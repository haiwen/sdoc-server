import DBHelper from "../db-helper";

export const recordOperations = (docUuid, operations, version, user) => {
  let sql = 'INSERT INTO `operation_log` \
    (doc_uuid, op_id, op_time, operations, author) VALUES (?, ?, ?, ?, ?)';
  let values = [docUuid, version, Date.now(), JSON.stringify(operations), user.username];
  return DBHelper(sql, values);
}

export const listPendingOperationsByDoc = (docUuid, version) => {
  let sql = `SELECT operations, op_id, author FROM operation_log WHERE \
    doc_uuid='${docUuid}' AND op_id>${version} ORDER BY op_id`;
  return DBHelper(sql);
}
