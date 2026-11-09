import io
import os
import warnings
from concurrent.futures import ProcessPoolExecutor
from functools import partial

import boto3
import pandas as pd
from tqdm import tqdm

warnings.filterwarnings("ignore", category=pd.errors.DtypeWarning)

# ---------------- CONFIGURATION ----------------
# Set relative path if running from the parent folder, or provide the full absolute path
BASE_RAW_DATA_PATH = os.path.expanduser("~/Downloads/01_raw data")
# e.g., on macOS/Linux: "/Users/username/Projects/.../01_raw data"
# e.g., on Windows: r"C:\Users\username\Projects\...\01_raw data"

PARQUET_TITLE = "DoorsWithWideAccompaniment"
S3_BUCKET = "smart-behaviors-database"
S3_PREFIX = f"Raw/{PARQUET_TITLE}"

# AWS Credentials:
# If you configured the AWS CLI via `aws configure`, boto3 discovers credentials automatically.
# If not, set them via environment variables or uncomment below:
# os.environ["AWS_ACCESS_KEY_ID"] = "YOUR_ACCESS_KEY"
# os.environ["AWS_SECRET_ACCESS_KEY"] = "YOUR_SECRET_KEY"
# os.environ["AWS_DEFAULT_REGION"] = "us-east-1"
# -----------------------------------------------

s3_client = None


def init_worker():
    """Initializes a standalone boto3 client per worker process."""
    global s3_client
    s3_client = boto3.client("s3")


def convert_and_upload_single_file(filename, source_dir, bucket_name, s3_prefix):
    """
    Reads a local raw CSV, converts it to Parquet in memory,
    and streams directly to S3 without intermediate disk writes.
    """
    csv_file_path = os.path.join(source_dir, filename)
    parquet_filename = filename.replace(".csv", ".parquet")
    s3_key = f"{s3_prefix.rstrip('/')}/{parquet_filename}"

    try:
        df = pd.read_csv(
            csv_file_path,
            skiprows=4,
            header=0,
            dtype=str,
        )

        buffer = io.BytesIO()
        df.to_parquet(buffer, index=False, engine="pyarrow")
        buffer.seek(0)

        s3_client.upload_fileobj(buffer, bucket_name, s3_key)
        return (filename, "Success")
    except Exception as e:
        return (filename, f"Error: {e}")


def main():
    if not os.path.exists(BASE_RAW_DATA_PATH):
        print(f"Source directory not found: {BASE_RAW_DATA_PATH}")
        return

    csv_files = sorted(
        [f for f in os.listdir(BASE_RAW_DATA_PATH) if f.endswith(".csv")]
    )

    if not csv_files:
        print(f"No CSV files found in: {BASE_RAW_DATA_PATH}")
        return

    print(f"Found {len(csv_files)} CSV files in: {BASE_RAW_DATA_PATH}")
    print(f"Streaming conversions directly to: s3://{S3_BUCKET}/{S3_PREFIX}/")

    worker_func = partial(
        convert_and_upload_single_file,
        source_dir=BASE_RAW_DATA_PATH,
        bucket_name=S3_BUCKET,
        s3_prefix=S3_PREFIX,
    )

    # Local disk reads have no cloud API throttling; scale workers to CPU cores
    max_workers = os.cpu_count() or 4
    print(f"Running conversion with {max_workers} parallel workers...")

    with ProcessPoolExecutor(
        max_workers=max_workers, initializer=init_worker
    ) as executor:
        results = list(
            tqdm(executor.map(worker_func, csv_files), total=len(csv_files))
        )

    successful_uploads = sum(1 for _, status in results if status == "Success")
    failures = [(name, status) for name, status in results if status != "Success"]

    print(
        f"\nCompleted: {successful_uploads}/{len(csv_files)} files uploaded successfully."
    )
    if failures:
        print(f"Encountered {len(failures)} errors:")
        for fname, err in failures[:10]:
            print(f" - {fname}: {err}")


# Required on local machines (macOS/Windows) to safely launch multiprocessing workers
if __name__ == "__main__":
    main()