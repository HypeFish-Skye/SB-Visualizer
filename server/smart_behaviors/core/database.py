import os
import duckdb
from typing import Generator
import boto3
from botocore.exceptions import NoCredentialsError, PartialCredentialsError


class DatabaseManager:
    _instance = None
    _con = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        # 1. Connect to catalog database
        db_path = os.getenv("MOCAP_DB_PATH")
        if not db_path:
            db_path = "data/mocap_catalog.duckdb" if os.path.exists("data/mocap_catalog.duckdb") else "mocap_catalog.duckdb"

        if os.path.exists(db_path):
            self._con = duckdb.connect(database=db_path, read_only=True)
        else:
            self._con = duckdb.connect(database=":memory:", read_only=False)

        # 2. Install & load httpfs
        self._con.execute("INSTALL httpfs; LOAD httpfs;")

        # 3. Resolve AWS credentials from active environment, ~/.aws/credentials, or SSO
        try:
            profile_name = os.getenv("AWS_PROFILE", None)
            session = boto3.Session(profile_name=profile_name)
            creds = session.get_credentials()

            if creds:
                frozen = creds.get_frozen_credentials()
                region = session.region_name or os.getenv("AWS_DEFAULT_REGION", "us-east-1")

                # Try modern DuckDB Secret Manager first (DuckDB >= 0.10)
                try:
                    secret_sql = f"""
                    CREATE OR REPLACE SECRET s3_creds (
                        TYPE S3,
                        KEY_ID '{frozen.access_key}',
                        SECRET '{frozen.secret_key}',
                        REGION '{region}'
                        {f", SESSION_TOKEN '{frozen.token}'" if frozen.token else ""}
                    );
                    """
                    self._con.execute(secret_sql)
                except Exception:
                    # Fallback to legacy SET parameters for older DuckDB versions
                    self._con.execute(f"SET s3_region='{region}';")
                    self._con.execute(f"SET s3_access_key_id='{frozen.access_key}';")
                    self._con.execute(f"SET s3_secret_access_key='{frozen.secret_key}';")
                    if frozen.token:
                        self._con.execute(f"SET s3_session_token='{frozen.token}';")

                print(f"[DatabaseManager] Authenticated to S3 (region: {region}, token_used: {bool(frozen.token)}).")
            else:
                print("[DatabaseManager] WARNING: No AWS credentials detected by boto3.")
        except (NoCredentialsError, PartialCredentialsError) as e:
            print(f"[DatabaseManager] WARNING: AWS credential resolution failed: {e}")
        except Exception as e:
            print(f"[DatabaseManager] Unexpected error loading AWS credentials: {e}")

    def get_cursor(self) -> duckdb.DuckDBPyConnection:
        if self._con is None:
            self._initialize()
        return self._con.cursor()


db_manager = DatabaseManager()


def get_db() -> Generator[duckdb.DuckDBPyConnection, None, None]:
    cursor = db_manager.get_cursor()
    try:
        yield cursor
    finally:
        cursor.close()