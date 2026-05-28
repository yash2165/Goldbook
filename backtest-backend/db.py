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

def parse_db_url(url):
    """
    Safely parses a postgresql:// URL even if the password contains special characters like '@' or ':'.
    """
    if not url.startswith("postgresql://") and not url.startswith("postgres://"):
        return {"dsn": url}
    
    prefix = "postgresql://" if url.startswith("postgresql://") else "postgres://"
    remaining = url[len(prefix):]
    
    if "@" not in remaining:
        return {"dsn": url}
        
    credentials, host_info = remaining.rsplit("@", 1)
    
    if ":" in credentials:
        user, password = credentials.split(":", 1)
    else:
        user = credentials
        password = ""
        
    if "/" in host_info:
        host_port, database = host_info.split("/", 1)
    else:
        host_port = host_info
        database = ""
        
    if ":" in host_port:
        host, port = host_port.split(":", 1)
    else:
        host = host_port
        port = "5432"
        
    return {
        "user": user,
        "password": password,
        "host": host,
        "port": port,
        "database": database
    }

# Initialize a Threaded connection pool to handle parallel WebSocket and REST requests safely
try:
    db_params = parse_db_url(DATABASE_URL)
    if "dsn" in db_params:
        pool = ThreadedConnectionPool(1, 40, dsn=db_params["dsn"])
    else:
        pool = ThreadedConnectionPool(1, 40, **db_params)
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
