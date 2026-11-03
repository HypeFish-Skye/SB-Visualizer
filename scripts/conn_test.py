import duckdb

conn = duckdb.connect("mocap_catalog.duckdb", read_only=True)
conn.execute("INSTALL httpfs; LOAD httpfs; CREATE OR REPLACE SECRET (TYPE S3, PROVIDER credential_chain);")

# Inspect the active 0DO trial and a 90DO crossing trial
trials_to_check = [
    "Bill_Dynamic_135LF_A_0DO",
    "90DO"
]

for pattern in trials_to_check:
    row = conn.execute(f"""
        SELECT filename FROM trials 
        WHERE study = 'ObstacleNavigation' AND filename LIKE '%{pattern}%'
        LIMIT 1
    """).fetchone()

    if not row:
        print(f"\nNo trial found matching pattern: {pattern}")
        continue

    file_path = row[0]
    print(f"\n{'='*75}\nFILE: {file_path.split('/')[-1]}\n{'='*75}")

    cols = conn.execute(f"SELECT * FROM read_parquet('{file_path}') LIMIT 0").fetchdf().columns.tolist()
    obs_cols = [c for c in cols if 'obstacle' in c.lower() and any(k in c.lower() for k in ['rel', 'pos', 'sep', 'dist', 'velo'])]
    
    print("Available Obstacle Kinematic Columns:")
    for c in obs_cols:
        print(f"  - {c}")

    # Inspect values at start, middle, and end of the trial
    target_cols = [c for c in obs_cols if any(k in c for k in [
        'RelativePositionX_DynamicObstacle01Follower01_Follower01Allocentric',
        'RelativePositionY_DynamicObstacle01Follower01_Follower01Allocentric',
        'RelativePositionX_DynamicObstacle01Follower01_Follower01Egocentric',
        'RelativePositionY_DynamicObstacle01Follower01_Follower01Egocentric',
        'RelativePositionX_Follower01DynamicObstacle01_DynamicObstacle01Allocentric',
        'RelativePositionY_Follower01DynamicObstacle01_DynamicObstacle01Allocentric',
        'SeparationDistance_Follower01DynamicObstacle01_World'
    ])]

    if target_cols:
        cols_sql = ", ".join(f'"{c}"' for c in target_cols)
        df = conn.execute(f"SELECT {cols_sql} FROM read_parquet('{file_path}')").fetchdf()
        
        n = len(df)
        indices = [0, n // 4, n // 2, (3 * n) // 4, n - 1]
        sample_df = df.iloc[indices]
        print("\nTrajectory Progress (Frames 0%, 25%, 50%, 75%, 100%):")
        print(sample_df.to_string())