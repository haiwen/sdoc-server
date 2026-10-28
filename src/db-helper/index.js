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
    const result = await callback(async (sql, values) => {
      // Match DBHelper's rows-only contract, including transactional reads.
      const [rows] = await connection.query(sql, values);
      return rows;
    });
    await connection.commit();
    return result;
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        // Never return a connection with an unresolved transaction to the
        // pool. Recovery uses a locking read on a fresh connection.
        connection.destroy();
        connection = null;
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
