from typing import List, Optional
import numpy as np
import duckdb
from fastapi import APIRouter, Depends, HTTPException, Query

from smart_behaviors.core.database import get_db
from smart_behaviors.core.catalog import CatalogService
from smart_behaviors.core.loader import TrajectoryLoader
from smart_behaviors.api.schemas import DTWMatch

# Import C++ accelerated core
try:
    from smart_behaviors import mocap_core
except ImportError:
    try:
        import mocap_core
    except ImportError:
        mocap_core = None

router = APIRouter()


def fallback_dtw_distance(seq_a: np.ndarray, seq_b: np.ndarray, window_ratio: float = 0.15) -> float:
    """Fast Sakoe-Chiba DTW fallback downsampled for high-frequency MoCap frames."""
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


@router.get("/search", response_model=List[DTWMatch])
def search_similar_trajectories(
    file_path: str = Query(..., description="Target file path to compare against"),
    top_k: int = Query(4, ge=1, le=10),
    db: duckdb.DuckDBPyConnection = Depends(get_db),
):
    """
    Executes Sakoe-Chiba DTW geometric search strictly scoped intra-study.
    Prefers native C++ mocap_core module when compiled.
    """
    # 1. Identify study category
    target_study = CatalogService.identify_study(file_path, db)
    if target_study == "Unknown":
        raise HTTPException(status_code=400, detail="Unable to determine study category for trial.")

    # 2. Fetch reference trajectory (use follower or leader depending on availability)
    target_traj = TrajectoryLoader.load_trajectory(db, file_path)
    ref_coords = target_traj.follower if target_traj.follower else target_traj.leader
    target_coords = np.array(ref_coords, dtype=np.float64)

    if len(target_coords) == 0:
        raise HTTPException(status_code=400, detail="Target trial has no valid trajectory coordinates.")

    # 3. Query candidate trials strictly from the SAME study
    candidates = CatalogService.list_trials(db, study_filter=target_study)
    matches: List[DTWMatch] = []
    window = max(10, int(len(target_coords) * 0.15))

    for candidate in candidates:
        if candidate.filename == file_path:
            continue

        try:
            cand_traj = TrajectoryLoader.load_trajectory(db, candidate.filename)
            cand_ref = cand_traj.follower if cand_traj.follower else cand_traj.leader
            cand_coords = np.array(cand_ref, dtype=np.float64)
            if len(cand_coords) == 0:
                continue

            # Compute similarity using compiled C++ or Python fallback
            if mocap_core and hasattr(mocap_core, "dtw_sakoe_chiba_3d"):
                distance = float(mocap_core.dtw_sakoe_chiba_3d(target_coords, cand_coords, window))
            else:
                distance = fallback_dtw_distance(target_coords, cand_coords, window_ratio=0.15)

            matches.append(
                DTWMatch(
                    filename=candidate.filename,
                    name=candidate.name,
                    dtw_distance=round(distance, 2),
                    study=target_study,
                )
            )
        except Exception:
            continue

    # 4. Rank by distance and return top K
    matches.sort(key=lambda m: m.dtw_distance)
    return matches[:top_k]