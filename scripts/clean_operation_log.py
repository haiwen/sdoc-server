import json
import sys
import os
import pymysql
import logging
from datetime import datetime
from logging import handlers


def setup_logger(log_name, log_dir):
    """
    setup logger
    """
    log_file = os.path.join(log_dir, log_name)
    handler = handlers.TimedRotatingFileHandler(log_file, when='D', interval=1, backupCount=7)
    formatter = logging.Formatter('%(asctime)s [%(levelname)s] %(message)s')
    handler.setFormatter(formatter)
    logging.root.setLevel(logging.INFO)
    logging.root.addHandler(handler)

    return logging.getLogger(log_name)


log_file = 'operation-log-cleaner.log '
log_dir = os.environ.get('LOG_DIR', '')
logger = setup_logger(log_file, log_dir)


def load_config():
    config_file = os.environ.get('SDOC_SERVER_CONFIG', '../config/config.json')
    with open(config_file, 'r') as f:
        content = f.read()
        return json.loads(content)


def clean_operation_log():
    config = load_config()
    user = config.get('user')
    password = config.get('password')
    database = config.get('database')
    host = config.get('host')
    connection = pymysql.connect(user=user, password=password, database=database, host=host)
    with connection:
        with connection.cursor() as cursor:
            count_sql = """SELECT COUNT(1) FROM `operation_log` WHERE
                                   op_time < UNIX_TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 3 DAY))*1000"""
            try:
                logger.info('Start count need to be cleaned up records.')
                print('[%s] Start count need to be cleaned up records.' % datetime.now())
                cursor.execute(count_sql)
                count = int(cursor.fetchone()[0])

                logger.info('The number of that need to be cleaned up records: %s' % count)
                print('[%s] The number of that need to be cleaned up records: %s' % (datetime.now(), count))
            except Exception as e:
                logger.error('Failed to count operation_log records, error: %s.' % e)
                sys.stderr.write('[%s] Failed to count operation_log records, error: %s.' % (datetime.now(), e))
                return

            # clean operation_log records
            logger.info('Cleaning up operation_log records...')
            print('[%s] Cleaning up operation_log records...' % datetime.now())
            step = 10000
            for i in range(0, count, step):
                clean_sql = f"""DELETE FROM `operation_log` WHERE
                                   op_time < UNIX_TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 3 DAY))*1000 LIMIT {step}"""

                try:
                    cursor.execute(clean_sql)
                except Exception as e:
                    logger.error('Failed to clean operation_log records, error: %s.' % e)
                    sys.stderr.write(
                        '[%s] Failed to clean operation_log records, error: %s.' % (datetime.now(), e))
                    return
            connection.commit()

            logger.info('Successfully cleaned operation_log records.')
            print('[%s] Successfully cleaned operation_log records.' % datetime.now())


if __name__ == '__main__':
    clean_operation_log()
