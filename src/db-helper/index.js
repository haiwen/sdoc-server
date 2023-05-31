import mysql from 'mysql';
import { MYSQL_CONFIG } from '../config/config';

// 初始化 MYSQL 配置（最大链接数默认是10，设置字符集和时区）
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

// 创建连接池
const pool = mysql.createPool(mysql_config);

// 数据库工具函数
const DBHelper = function (sql, values) {
  return new Promise((resolve, reject) => {
    // 先获取链接
    pool.getConnection(function (err, connection) {
      if (err) {
        reject(err);
      } else {
        // 执行查询操作，并返回结果
        connection.query(sql, values, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
          // 断开连接
          connection.release();
        });
      }
    });
  });
};

export default DBHelper;
