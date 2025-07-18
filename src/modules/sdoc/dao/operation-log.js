import DBHelper from "../../../db-helper";

export const recordOperations = (docUuid, operations, version, user) => {
  const sql = 'INSERT INTO `sdoc_operation_log` \
    (doc_uuid, op_id, op_time, operations, author) VALUES (?, ?, ?, ?, ?)';
  const values = [docUuid, version, Date.now(), JSON.stringify(operations), user.username];
  return DBHelper(sql, values);
};

export const listPendingOperationsByDoc = (docUuid, version) => {
  const sql = `SELECT operations, op_id, author FROM sdoc_operation_log WHERE \
    doc_uuid='${docUuid}' AND op_id>${version} ORDER BY op_id`;
  return DBHelper(sql);
};

export const queryOperationCount = (interval) => {
  const lastTimeStamp = interval !== -1 ? Date.now() - interval : -1;
  const sql = `SELECT count(1) AS count FROM sdoc_operation_log WHERE op_time>=${lastTimeStamp}`;
  return DBHelper(sql);
};
