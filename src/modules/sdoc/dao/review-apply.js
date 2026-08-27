import DBHelper from '../../../db-helper';

const deserialize = (row) => ({
  ...row,
  result: typeof row.result === 'string' ? JSON.parse(row.result) : row.result,
});

export const getReviewApplyRegistration = async (applyAttemptId, executor = DBHelper) => {
  const rows = await executor(
    'SELECT apply_attempt_id, doc_uuid, apply_payload_digest, status, result FROM sdoc_review_apply_registration WHERE apply_attempt_id=?',
    [applyAttemptId],
  );
  return rows.length ? deserialize(rows[0]) : null;
};

export const createReviewApplyRegistration = (registration, executor = DBHelper) => {
  const sql = 'INSERT INTO `sdoc_review_apply_registration` \
    (apply_attempt_id, doc_uuid, apply_payload_digest, status, result, created_at, updated_at) \
    VALUES (?, ?, ?, ?, ?, ?, ?)';
  const now = Date.now();
  return executor(sql, [
    registration.applyAttemptId,
    registration.docUuid,
    registration.applyPayloadDigest,
    registration.status,
    JSON.stringify(registration.result),
    now,
    now,
  ]);
};
