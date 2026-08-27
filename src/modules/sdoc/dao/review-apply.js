import DBHelper from '../../../db-helper';

const deserialize = (row) => {
  const result = typeof row.result === 'string' ? JSON.parse(row.result) : {...row.result};
  // The result snapshot is written at Apply time. Persistence confirmation is
  // updated later, so return the authoritative columns after a process restart.
  if (row.persistence_status) result.persistence_status = row.persistence_status;
  if (row.applied_sdoc_version !== null && row.applied_sdoc_version !== undefined) {
    result.applied_sdoc_version = row.applied_sdoc_version;
  }
  return {...row, result};
};

export const getReviewApplyRegistration = async (applyAttemptId, executor = DBHelper) => {
  const rows = await executor(
    'SELECT apply_attempt_id, doc_uuid, apply_payload_digest, status, persistence_status, applied_sdoc_version, result FROM sdoc_review_apply_registration WHERE apply_attempt_id=?',
    [applyAttemptId],
  );
  return rows.length ? deserialize(rows[0]) : null;
};

export const createReviewApplyRegistration = (registration, executor = DBHelper) => {
  const sql = 'INSERT INTO `sdoc_review_apply_registration` \
    (apply_attempt_id, doc_uuid, apply_payload_digest, status, persistence_status, applied_sdoc_version, result, created_at, updated_at) \
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
  const now = Date.now();
  return executor(sql, [
    registration.applyAttemptId,
    registration.docUuid,
    registration.applyPayloadDigest,
    registration.status,
    registration.persistenceStatus || 'pending',
    registration.result.applied_sdoc_version,
    JSON.stringify(registration.result),
    now,
    now,
  ]);
};

export const listPendingReviewSaveRegistrations = async (docUuid, savedVersion = null, executor = DBHelper) => {
  let sql = 'SELECT apply_attempt_id, doc_uuid, apply_payload_digest, status, persistence_status, applied_sdoc_version, result FROM sdoc_review_apply_registration WHERE doc_uuid=? AND status=\'applied\' AND persistence_status=\'pending\'';
  const values = [docUuid];
  if (savedVersion !== null) {
    sql += ' AND applied_sdoc_version<=?';
    values.push(savedVersion);
  }
  const rows = await executor(sql, values);
  return rows.map(deserialize);
};

export const markReviewApplyPersistence = (applyAttemptId, persistenceStatus, executor = DBHelper) => {
  return executor(
    'UPDATE sdoc_review_apply_registration SET persistence_status=?, updated_at=? WHERE apply_attempt_id=?',
    [persistenceStatus, Date.now(), applyAttemptId],
  );
};

export const listPendingReviewSaveDocUuids = async (executor = DBHelper) => {
  const rows = await executor(
    'SELECT DISTINCT doc_uuid FROM sdoc_review_apply_registration WHERE status=\'applied\' AND persistence_status=\'pending\'',
  );
  return rows.map(row => row.doc_uuid);
};
