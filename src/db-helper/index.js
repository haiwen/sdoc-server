import mysql from 'mysql2/promise'; 
import { MYSQL_CONFIG } from '../config/config';

const mysql_config = {
  host: MYSQL_CONFIG.host,
  user: MYSQL_CONFIG.user,
  password: MYSQL_CONFIG.password,
  database: MYSQL_CONFIG.database,
  port: MYSQL_CONFIG.port,
  charset: "UTF8MB4",
  connectionLimit: MYSQL_CONFIG.connectionLimit === undefined ? 10 : MYSQL_CONFIG.connectionLimit,
  timezone: '+00:00'
};

const pool = mysql.createPool(mysql_config);

const DBHelper = async function (sql, values) {
  try {
    const [rows] = await pool.query(sql, values);
    return rows;
  } catch (err) {
    const error = new Error(err.message.includes('connect') ? 'Error connecting to Database' : 'Query data from Database error');
    error.error_type = 'database_error';
    error.originalError = err; 
    throw error;
  }
};

export const withTransaction = async (callback) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const result = await callback((sql, values) => connection.query(sql, values));
    await connection.commit();
    return result;
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        // Preserve the original database error.
      }
    }
    const error = new Error(err.message && err.message.includes('connect') ? 'Error connecting to Database' : 'Query data from Database error');
    error.error_type = 'database_error';
    error.originalError = err;
    throw error;
  } finally {
    if (connection) connection.release();
  }
};

export default DBHelper;
