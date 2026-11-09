# `import os
# import boto3
# import duckdb
# from smart_behaviors.core.database import db_manager

# BUCKET_NAME = "smart-behaviors-database"
# SRC_PREFIX = "intention-study/Intermediate/ReadingWallIntentions/Feature/20261103-223258/wall_sigma60/features/"
# DST_PREFIX = "Intermediate/ReadingWallIntentions/Features/"


# def list_source_feature_files(s3_client, bucket: str, prefix: str):
#     """Paginates and lists ONLY *.features.csv keys, explicitly ignoring summary files."""
#     paginator = s3_client.get_paginator("list_objects_v2")
#     target_keys = []

#     for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
#         for obj in page.get("Contents", []):
#             key = obj["Key"]
#             filename = key.split("/")[-1]

#             # Strict match: must end with .features.csv and must not be a summary file
#             if filename.endswith(".features.csv") and "summary" not in filename.lower():
#                 target_keys.append(key)

#     return target_keys


# def run_conversion(dry_run: bool = False):
#     s3_client = boto3.client("s3")
#     con = db_manager.get_cursor()

#     print(f"Scanning s3://{BUCKET_NAME}/{SRC_PREFIX} ...")
#     feature_keys = list_source_feature_files(s3_client, BUCKET_NAME, SRC_PREFIX)

#     if not feature_keys:
#         print("No matching *.features.csv files found.")
#         return

#     print(f"Found {len(feature_keys)} matching *.features.csv files (all summary/other CSVs excluded).\n")

#     converted_count = 0
#     failed_keys = []

#     for idx, key in enumerate(feature_keys, start=1):
#         filename = key.split("/")[-1]
#         # 'Trial_01.features.csv' -> 'Trial_01.parquet'
#         parquet_name = filename[:-len(".features.csv")] + ".parquet"

#         src_s3_url = f"s3://{BUCKET_NAME}/{key}"
#         dst_s3_url = f"s3://{BUCKET_NAME}/{DST_PREFIX}{parquet_name}"

#         print(f"[{idx}/{len(feature_keys)}] {filename} -> {parquet_name}")

#         if dry_run:
#             continue

#         try:
#             con.execute(f"""
#                 COPY (
#                     SELECT * FROM read_csv_auto('{src_s3_url}', header=True, all_varchar=False)
#                 ) 
#                 TO '{dst_s3_url}' (FORMAT PARQUET, COMPRESSION 'ZSTD');
#             """)
#             converted_count += 1
#         except Exception as e:
#             print(f"  [Direct copy error: {e}] Retrying via buffered upload...")
#             try:
#                 local_temp = f"/tmp/{parquet_name}"
#                 con.execute(f"""
#                     COPY (
#                         SELECT * FROM read_csv_auto('{src_s3_url}', header=True)
#                     ) TO '{local_temp}' (FORMAT PARQUET, COMPRESSION 'ZSTD');
#                 """)
#                 s3_client.upload_file(local_temp, BUCKET_NAME, f"{DST_PREFIX}{parquet_name}")
#                 if os.path.exists(local_temp):
#                     os.remove(local_temp)
#                 converted_count += 1
#             except Exception as e_fallback:
#                 print(f"  [FATAL] Failed to convert {filename}: {e_fallback}")
#                 failed_keys.append(key)

#     print("\n" + "=" * 50)
#     print(f"Complete: {converted_count if not dry_run else 0}/{len(feature_keys)} processed.")
#     if failed_keys:
#         print(f"Failed keys: {failed_keys}")


# if __name__ == "__main__":
#     import sys
#     dry = "--dry-run" in sys.argv
#     run_conversion(dry_run=dry)`