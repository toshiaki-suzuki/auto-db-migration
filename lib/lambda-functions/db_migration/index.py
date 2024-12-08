import logging
import os
import subprocess
import json
import requests

DB_SECRET_NAME = os.environ.get('DB_SECRET_NAME')

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    logger.info(f"event: {event}")

    db_secret =  _get_secret_string() if DB_SECRET_NAME else {}

    database = db_secret.get("database", "postgresql")
    db_user = db_secret.get("username", "postgres")
    db_pass = db_secret.get("password", "password")
    db_host = db_secret.get("host", "localhost")
    db_port = str(db_secret.get("port", 5432))
    db_name = db_secret.get("dbname", "db_migration")

    os.environ['DATABASE'] = database
    os.environ['DB_USER'] = db_user
    os.environ['DB_PASS'] = db_pass
    os.environ['DB_HOST'] = db_host
    os.environ['DB_PORT'] = db_port
    os.environ['DB_NAME'] = db_name

    # alembic.iniファイルの環境変数を設定
    alembic_env = {
        **os.environ,
        'DATABASE': 'postgresql',
        'DB_USER': db_user,
        'DB_PASS': db_pass,
        'DB_HOST': db_host,
        'DB_PORT': db_port,
        'DB_NAME': db_name
    }

    # カスタムリソースの物理IDを設定
    # 物理IDとは、リソースの一意な識別子で、リソースの作成時に指定する
    resource_properties = event.get('ResourceProperties', {})
    physical_resource_id = resource_properties.get('physicalResourceId', 'x65a90km-4675-9223-io8x-9i81p67773fd')
    logger.info(f"physical_resource_id: {physical_resource_id}")
    logger.info(f"RequestType: {resource_properties}")

    # RequestTypeがCreateまたはUpdateの場合はマイグレーションを実行
    if resource_properties == 'Delete':
        return {
            'PhysicalResourceId': physical_resource_id,
        }

    # alembic.iniファイルの環境変数を設定
    try:
        old_version = _get_current_version()

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

        new_version = _get_current_version()
        logger.info(f"Migration success from {old_version} to {new_version}")

    except Exception as error:
        logger.error(f"Migration execution failed: {error}")
        raise  # エラーを再スローしてロールバックをトリガー

    return {
        'PhysicalResourceId': physical_resource_id,
    }

def _get_secret_string():
    endpoint = f"http://localhost:2773/secretsmanager/get?secretId={DB_SECRET_NAME}"
    secrets_headers = {
        "X-Aws-Parameters-Secrets-Token": os.environ.get("AWS_SESSION_TOKEN"),
    }
    try:
        response = requests.get(endpoint, headers=secrets_headers)
        return json.loads(response.json().get("SecretString", "{}"))
    except Exception as error:
        logger.error(f"Failed to get secret string: {error}")
        raise error

def _get_current_version():
    result = subprocess.run(
        ["python3", "-m", "alembic", "current"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    return result.stdout.strip()


# ローカルでのテスト用
# if __name__ == '__main__':
#     lambda_handler({}, {})
