import os
import psycopg2
from psycopg2.pool import ThreadedConnectionPool
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from dotenv import load_dotenv

# Load env variables from .env file if it exists
load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://backtest_user:your_strong_password_here@localhost:5432/backtest_db"
)

# Initialize a Threaded connection pool to handle parallel WebSocket and REST requests safely
try:
    pool = ThreadedConnectionPool(1, 40, dsn=DATABASE_URL)
except Exception as e:
    print(f"CRITICAL ERROR: Failed to connect to PostgreSQL pool: {e}")
    pool = None

@contextmanager
def get_db_connection():
    if pool is None:
        raise ConnectionError("PostgreSQL connection pool is not initialized.")
    conn = pool.getconn()
    try:
        yield conn
    finally:
        pool.putconn(conn)

@contextmanager
def get_db_cursor(commit=False):
    """
    Context manager that yields a dictionary-based database cursor.
    Auto-commits transactions if commit=True. Auto-rolls back on exception.
    """
    with get_db_connection() as conn:
        # Use RealDictCursor to return rows as dictionaries (e.g. row['entry_price'])
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        try:
            yield cursor
            if commit:
                conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
