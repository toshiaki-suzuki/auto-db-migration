import logging
import os
import subprocess
import json
import boto3

DB_SECRET_NAME = os.environ.get('DB_SECRET_NAME')

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    logger.info(f"event: {event}")

    db_secret =  _get_secret_string() if DB_SECRET_NAME else {}

    database = db_secret.get("database", "postgresql+psycopg2")
    db_user = db_secret.get("username", "postgres")
    db_pass = db_secret.get("password", "password")
    db_host = db_secret.get("host", "localhost")
    db_port = str(db_secret.get("port", 5432))
    db_name = db_secret.get("dbname", "db_migration")

    logger.info(f"URL: {database}://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}")

    os.environ['DATABASE'] = database
    os.environ['DB_USER'] = db_user
    os.environ['DB_PASSWORD'] = db_pass
    os.environ['DB_HOST'] = db_host
    os.environ['DB_PORT'] = db_port
    os.environ['DB_NAME'] = db_name

    # alembic.iniファイルの環境変数を設定
    alembic_env = {
        **os.environ,
        'DATABASE': database,
        'DB_USER': db_user,
        'DB_PASSWORD': db_pass,
        'DB_HOST': db_host,
        'DB_PORT': db_port,
        'DB_NAME': db_name
    }

    # カスタムリソースの物理IDを設定
    # 物理IDとは、リソースの一意な識別子で、リソースの作成時に指定する
    request_type = event.get('RequestType', {})
        # もともとCFNから渡されるPhysicalResourceIdを参照
    physical_resource_id = event.get('PhysicalResourceId')

    if request_type == 'Create':
        # Createの場合のみ新しいIDを生成または決定
        physical_resource_id = '0c00zzzz-8b4f-4857-a0ee-70783364aad6'  # 生成した固有ID

    logger.info(f"physical_resource_id: {physical_resource_id}")
    logger.info(f"RequestType: {request_type}")

    # RequestTypeがCreateまたはUpdateの場合はマイグレーションを実行
    if request_type == 'Delete':
        return {
            'PhysicalResourceId': physical_resource_id,
        }

    # alembic.iniファイルの環境変数を設定
    try:
        old_version = _get_current_version(alembic_env)
        logger.info(f"Current version: {old_version}")

        result = subprocess.run(
            ["python3", "-m", "alembic", "upgrade", "head"],
            env=alembic_env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        logger.info(result.stdout)

        if result.returncode != 0:
            error_message = f"Migration failed with stderr: {result.stderr}"
            logger.error(error_message)
            raise Exception(error_message)

        new_version = _get_current_version(alembic_env)
        logger.info(f"Migration success from {old_version} to {new_version}")

    except Exception as error:
        logger.info(result.stdout)
        logger.error(f"Migration execution failed: {error}")
        raise  error # エラーを再スローしてロールバックをトリガー

    return {
        'PhysicalResourceId': physical_resource_id,
    }

def _get_secret_string():

    try:
        client = boto3.client('secretsmanager')
        response = client.get_secret_value(SecretId=DB_SECRET_NAME)
        secret_value = response.get("SecretString", "{}")
        return json.loads(secret_value)
    except Exception as error:
        logger.error(f"Failed to get secret string: {error}")
        raise error

def _get_current_version(alembic_env):
    try:
        result = subprocess.run(
            ["python3", "-m", "alembic", "current"],
            env=alembic_env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        return result.stdout.strip()
    except Exception as error:
        logger.info(result.stdout)
        logger.error(f"Failed to get current version: {error}")
        raise error


# ローカルでのテスト用
# if __name__ == '__main__':
#     lambda_handler({}, {})
