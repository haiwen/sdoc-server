import DBHelper from "../db-helper";
import { uuidStrTo32Chars } from "../utils";

const TABLE_NAME = 'base_filecomment';

export const listComments = (docUuid) => {
  docUuid = uuidStrTo32Chars(docUuid);
  const sql = `SELECT * FROM ${TABLE_NAME} WHERE uuid_id = '${docUuid}'`;
  return DBHelper(sql);
};

export const insertComment = (docUuid, commentInfo) => {
  docUuid = uuidStrTo32Chars(docUuid);
  const { comment, author, updated_at, detail } = commentInfo;
  const created_at = updated_at;
  const sql = `INSERT INTO ${TABLE_NAME} (uuid_id, comment, detail, author, created_at, updated_at, resolved) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  const values = [docUuid, comment, JSON.stringify(detail), author, created_at, updated_at, 0];
  return DBHelper(sql, values);
};

export const deleteComment = (commentId) => {
  const sql = `DELETE FROM ${TABLE_NAME} WHERE id = ${commentId}`;
  return DBHelper(sql);
};

export const updateComment = (commentId, commentInfo) => {
  const { comment, detail, updated_at } = commentInfo;
  const sql = `UPDATE ${TABLE_NAME} SET comment = ?, detail = ?, updated_at = ? WHERE id = ?`;
  const values = [comment, JSON.stringify(detail), updated_at, commentId];
  return DBHelper(sql, values);
};
