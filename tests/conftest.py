import pytest
import numpy as np
import pandas as pd
import duckdb
from pathlib import Path


@pytest.fixture
def in_memory_db():
    con = duckdb.connect(database=":memory:")
    con.execute("""
        CREATE TABLE trials (
            filename VARCHAR PRIMARY KEY,
            study VARCHAR,
            metric_speed DOUBLE,
            metric_separation DOUBLE,
            frame_count INTEGER
        );
    """)
    yield con
    con.close()


@pytest.fixture
def mock_standard_world_parquet(tmp_path: Path) -> Path:
    """Standard meters World coordinates (Cornering / ContactlessPushing)."""
    n = 120
    t = np.linspace(0, 1.0, n)
    df = pd.DataFrame({
        "PositionX_Leader01_World": np.sin(t) * 2.0,
        "PositionY_Leader01_World": np.cos(t) * 2.0,
        "PositionZ_Leader01_World": np.full(n, 1.0),
        "PositionX_Follower01_World": np.sin(t) * 1.5,
        "PositionY_Follower01_World": np.cos(t) * 1.5,
        "PositionZ_Follower01_World": np.full(n, 0.6),
        "VelocityMagnitude_Leader01_World": np.full(n, 1.2),
        "VelocityMagnitude_Follower01_World": np.full(n, 0.9),
        "SeparationDistance_Leader01Follower01_World": np.full(n, 0.5),
        "Curvature_Follower01_World": np.full(n, 0.05),
    })
    path = tmp_path / "standard_world.parquet"
    df.to_parquet(path)
    return path


@pytest.fixture
def mock_millimeter_parquet(tmp_path: Path) -> Path:
    """Millimeter-scale coordinates and mm/s velocities (ObstacleNavigation)."""
    n = 120
    df = pd.DataFrame({
        "PositionX_Leader01_World": np.linspace(900.0, 1200.0, n),
        "PositionY_Leader01_World": np.linspace(-50.0, 100.0, n),
        "PositionZ_Leader01_World": np.full(n, 1000.0),
        "PositionX_Follower01_World": np.linspace(800.0, 1100.0, n),
        "PositionY_Follower01_World": np.linspace(-60.0, 90.0, n),
        "PositionZ_Follower01_World": np.full(n, 600.0),
        "ScalarVelocity_Leader01_World": np.full(n, 1250.0),      # mm/s
        "ScalarVelocity_Follower01_World": np.full(n, 950.0),     # mm/s
        "SeparationDistance_Leader01Follower01_World": np.full(n, 100.0),
    })
    path = tmp_path / "obstacle_mm.parquet"
    df.to_parquet(path)
    return path


@pytest.fixture
def mock_individual_parquet(tmp_path: Path) -> Path:
    """Two-pedestrian corridor format (OvertakingBypassing)."""
    n = 120
    df = pd.DataFrame({
        "PositionX_Individual01_World": np.linspace(0.0, 5.0, n),
        "PositionY_Individual01_World": np.full(n, -0.4),
        "PositionZ_Individual01_World": np.full(n, 1.0),
        "PositionX_Individual02_World": np.linspace(5.0, 0.0, n),
        "PositionY_Individual02_World": np.full(n, 0.4),
        "PositionZ_Individual02_World": np.full(n, 1.0),
        "VelocityMagnitude_Individual01_World": np.full(n, 1.1),
        "VelocityMagnitude_Individual02_World": np.full(n, 1.1),
    })
    path = tmp_path / "overtaking_individuals.parquet"
    df.to_parquet(path)
    return path


@pytest.fixture
def mock_allocentric_parquet(tmp_path: Path) -> Path:
    """Allocentric frame with relative vectors (FollowingAccompaniedLeader)."""
    n = 120
    foll_x = np.linspace(0.0, 2.0, n)
    foll_y = np.linspace(0.0, 1.0, n)
    df = pd.DataFrame({
        "RelativePositionX_Follower01_Follower01Allocentric": foll_x,
        "RelativePositionY_Follower01_Follower01Allocentric": foll_y,
        "RelativePositionX_Leader01Follower01_Follower01Allocentric": np.full(n, 0.9),
        "RelativePositionY_Leader01Follower01_Follower01Allocentric": np.full(n, 0.1),
        "RelativePositionX_DynamicObject01Follower01_Follower01Allocentric": np.full(n, -0.5),
        "RelativePositionY_DynamicObject01Follower01_Follower01Allocentric": np.full(n, 0.4),
        "ScalarVelocity_Follower01_World": np.full(n, 0.8),
        "ScalarVelocity_Leader01_World": np.full(n, 1.0),
    })
    path = tmp_path / "accompanied_allocentric.parquet"
    df.to_parquet(path)
    return path