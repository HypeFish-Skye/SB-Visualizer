import os
from typing import List
import numpy as np
from fastapi import APIRouter, Depends, Query, HTTPException
import duckdb

from smart_behaviors.core.database import get_db
from smart_behaviors.core.catalog import CatalogService
from smart_behaviors.core.loader import TrajectoryLoader
from smart_behaviors.api.schemas import DTWMatch

# 1. Resolve compiled pybind11 extension from package namespace
try:
    from smart_behaviors import mocap_core  # type: ignore[import-not-found]
except ImportError:
    try:
        import mocap_core  # type: ignore[import-not-found]
    except ImportError:
        mocap_core = None

router = APIRouter(tags=["search"])
S3_BUCKET = os.getenv("MOCAP_S3_BUCKET", "s3://pff-mocap-data/trials")


def fallback_dtw_distance(seq_a: np.ndarray, seq_b: np.ndarray, window_ratio: float = 0.15) -> float:
    """Fast Sakoe-Chiba DTW fallback downsampled for high-frequency MoCap frames."""
    # Decimate long sequences (downsample to ~350 frames) for instant Python calculation
    step_a = max(1, len(seq_a) // 350)
    step_b = max(1, len(seq_b) // 350)
    a = seq_a[::step_a]
    b = seq_b[::step_b]

    n, m = len(a), len(b)
    w = max(int(max(n, m) * window_ratio), abs(n - m))

    cost = np.full((n + 1, m + 1), np.inf)
    cost[0, 0] = 0.0

    for i in range(1, n + 1):
        j_min = max(1, i - w)
        j_max = min(m + 1, i + w + 1)
        for j in range(j_min, j_max):
            dist = np.linalg.norm(a[i - 1] - b[j - 1])
            cost[i, j] = dist + min(cost[i - 1, j], cost[i, j - 1], cost[i - 1, j - 1])

    return float(cost[n, m])