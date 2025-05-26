import mysql from 'mysql';
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

const DBHelper = function (sql, values) {
  return new Promise((resolve, reject) => {
    pool.getConnection(function (err, connection) {
      if (err) {
        const error = new Error('Error connecting to Database');
        error.error_type = 'database_error';
        reject(error);
      } else {
        connection.query(sql, values, (err, rows) => {
          if (err) {
            const error = new Error('Query data from Database error');
            error.error_type = 'database_error';
            reject(error);
          } else {
            resolve(rows);
          }
          connection.release();
        });
      }
    });
  });
};

export default DBHelper;
