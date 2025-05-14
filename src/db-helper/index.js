import dmdb from 'dmdb';
import { MYSQL_CONFIG } from '../config/config';

const db_config = {
  host: MYSQL_CONFIG.host,
  user: MYSQL_CONFIG.user,
  password: MYSQL_CONFIG.password,
  database: MYSQL_CONFIG.database,
  port: MYSQL_CONFIG.port,
  charset: "UTF8MB4",
  connectionLimit: MYSQL_CONFIG.connectionLimit === undefined ? 10 : MYSQL_CONFIG.connectionLimit,
  timezone: '+00:00'
};

const { user, password, host, port } = db_config;
const connect_string = `dm://${user}:${password}@${host}:${port}?autoCommit=false&loginEncrypt=false`;

let pool, connection;

async function createPool() {
  try {
    return await dmdb.createPool({
      connectString: connect_string,
      poolMax: 10,
      poolMin: 1
    });
  } catch (err) {
    throw new Error("createPool error: " + err.message);
  }
}

async function getConnection() {
  try {
    return await pool.getConnection();
  } catch (err) {
    throw new Error("getConnection error: " + err.message);
  }
}

const DBHelper = function (sql, values) {
  return new Promise(async (resolve, reject) => {
    try {
      if (!pool) {
        pool = await createPool();
      }
      connection = await getConnection();
      let result = await connection.execute(sql, values);
      await connection.commit();
      await connection.release();
      resolve(result)
    } catch (err) {
      reject(err);
    }
  });
};

export default DBHelper;
