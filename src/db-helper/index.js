import mysql from 'mysql';
import { MYSQL_CONFIG } from '../config/config';

const mysql_config = {
  host    : MYSQL_CONFIG.host,
  user    : MYSQL_CONFIG.user,
  password: MYSQL_CONFIG.password,
  database: MYSQL_CONFIG.database,
  port    : MYSQL_CONFIG.port,
  charset : "UTF8MB4",
  connectionLimit: MYSQL_CONFIG.connectionLimit === undefined ? 10 : MYSQL_CONFIG.connectionLimit,
  timezone: '+00:00'
};

let pool = mysql.createPool(mysql_config);

function DBHelper(sql, callback, add = null) {
  if (add !== null) {
    pool.query(sql, add, callback);
  } else {
    pool.query(sql, callback);
  }
}

export default DBHelper;
