from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")


def get_database_url() -> str:
    url = (os.getenv("DATABASE_URL") or "").strip()
    if not url:
        os.makedirs(DATA_DIR, exist_ok=True)
        return f"sqlite:///{os.path.join(DATA_DIR, 'expenses.db')}"
    if url.startswith("postgres://"):
        url = "postgresql+psycopg2://" + url[len("postgres://"):]
    elif url.startswith("postgresql://") and "+psycopg2://" not in url:
        url = "postgresql+psycopg2://" + url[len("postgresql://"):]
    return url


SQLALCHEMY_DATABASE_URL = get_database_url()
IS_SQLITE = SQLALCHEMY_DATABASE_URL.startswith("sqlite")

engine_kwargs = {"pool_pre_ping": True}
if IS_SQLITE:
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(SQLALCHEMY_DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def migrate_schema():
    """Add columns that create_all will not add to an existing SQLite table."""
    if not IS_SQLITE:
        return
    with engine.begin() as conn:
        rows = conn.exec_driver_sql("PRAGMA table_info(expenses)").fetchall()
        if not rows:
            return
        columns = {row[1] for row in rows}
        if "owner" not in columns:
            conn.exec_driver_sql(
                "ALTER TABLE expenses ADD COLUMN owner VARCHAR DEFAULT 'ฉัน'"
            )
            conn.exec_driver_sql(
                "UPDATE expenses SET owner = 'ฉัน' WHERE owner IS NULL"
            )
            conn.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_expenses_owner ON expenses (owner)"
            )
