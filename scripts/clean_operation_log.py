import json
import sys
import os
import pymysql
import logging
import argparse
from datetime import datetime
from logging import handlers

logger = logging.getLogger(__name__)


def init_logging(args):
    level = args.loglevel

    if level == 'debug':
        level = logging.DEBUG
    elif level == 'info':
        level = logging.INFO
    elif level == 'warning':
        level = logging.WARNING
    else:
        level = logging.INFO

    if args.logfile == sys.stdout:
        kw = {
            'format': '%(asctime)s [%(levelname)s] %(name)s:%(lineno)s: %(message)s',
            'level': level,
            'stream': args.logfile
        }

        logging.basicConfig(**kw)
    else:
        log_file = str(args.logfile.name)
        handler = logging.handlers.TimedRotatingFileHandler(log_file, when='W0', interval=1, backupCount=3)
        handler.setLevel(level)
        formatter = logging.Formatter('[%(asctime)s] [%(levelname)s] %(name)s:%(lineno)s: %(message)s', datefmt='%m/%d/%Y %H:%M:%S')
        handler.setFormatter(formatter)

        logging.root.setLevel(level)
        logging.root.addHandler(handler)


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
                cursor.execute(count_sql)
                count = int(cursor.fetchone()[0])

                logger.info('The number of that need to be cleaned up records: %s' % count)
            except Exception as e:
                logger.error('Failed to count operation_log records, error: %s.' % e)
                sys.stderr.write('[%s] Failed to count operation_log records, error: %s.' % (datetime.now(), e))
                return

            # clean operation_log records
            logger.info('Cleaning up operation_log records...')
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


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        '--logfile',
        default=sys.stdout,
        type=argparse.FileType('a'),
        help='log file')

    parser.add_argument(
        '--loglevel',
        default='info',
        help='log level')

    args = parser.parse_args()
    init_logging(args)

    clean_operation_log()


if __name__ == '__main__':
    main()
