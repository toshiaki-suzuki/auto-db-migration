from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

# .env ファイルの読み込み
load_dotenv()

# 環境変数からデータベースURLを構築
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql+psycopg2://postgres:password@localhost:15432/db_migration')

# エンジンの作成
engine = create_engine(
    DATABASE_URL,
    echo=True,  # SQLの実行ログを表示（開発時のみTrueに設定）
)

# セッションローカルの作成
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ベースクラスの作成
Base = declarative_base()
