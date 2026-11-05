import numpy as np
import duckdb
from smart_behaviors.core.loader import TrajectoryLoader
import pytest


def test_load_standard_world(mock_standard_world_parquet):
    con = duckdb.connect(":memory:")
    traj = TrajectoryLoader.load_trajectory(con, str(mock_standard_world_parquet))

    assert len(traj.leader) == 120
    assert len(traj.follower) == 120

    # Ensure coordinates sit flush on the floor plane (Y = 0.02)
    assert all(coord[1] == 0.02 for coord in traj.leader)
    assert all(coord[1] == 0.02 for coord in traj.follower)

    # Telemetry extraction
    assert len(traj.telemetry.leader_speed) == 120
    assert traj.telemetry.leader_speed[0] == pytest.approx(1.2, abs=0.01)
    assert traj.telemetry.separation[0] == pytest.approx(0.5, abs=0.01)


def test_load_millimeter_normalization(mock_millimeter_parquet):
    con = duckdb.connect(":memory:")
    traj = TrajectoryLoader.load_trajectory(con, str(mock_millimeter_parquet))

    # Raw positions ~900-1200 mm must be scaled to ~0.9-1.2 m
    first_leader_x = traj.leader[0][0]
    assert 0.8 < first_leader_x < 1.5, f"Expected scaled meter coordinate, got {first_leader_x}"

    # Raw speed 1250 mm/s must be normalized to ~1.25 m/s
    lead_speed = traj.telemetry.leader_speed[0]
    assert 1.0 < lead_speed < 1.5, f"Expected scaled m/s speed, got {lead_speed}"


def test_load_individual_corridor_mapping(mock_individual_parquet):
    con = duckdb.connect(":memory:")
    traj = TrajectoryLoader.load_trajectory(con, str(mock_individual_parquet))

    # Individual01 maps to leader, Individual02 maps to follower
    assert len(traj.leader) == 120
    assert len(traj.follower) == 120
    assert traj.leader[0][0] == pytest.approx(0.0, abs=1e-4)
    assert traj.follower[0][0] == pytest.approx(5.0, abs=1e-4)


def test_load_allocentric_reconstruction(mock_allocentric_parquet):
    con = duckdb.connect(":memory:")
    traj = TrajectoryLoader.load_trajectory(con, str(mock_allocentric_parquet))

    assert len(traj.follower) == 120
    assert len(traj.leader) == 120
    assert len(traj.accompanier) == 120

    # Leader was defined at follower + (0.9, 0.1)
    foll_x0 = traj.follower[0][0]
    foll_z0 = traj.follower[0][2]
    lead_x0 = traj.leader[0][0]
    lead_z0 = traj.leader[0][2]

    assert lead_x0 == pytest.approx(foll_x0 + 0.9, abs=1e-4)
    assert lead_z0 == pytest.approx(foll_z0 + 0.1, abs=1e-4)