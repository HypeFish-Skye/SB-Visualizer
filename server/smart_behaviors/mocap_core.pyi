import numpy as np
import numpy.typing as npt

def dtw_sakoe_chiba_3d(
    seq_a: npt.NDArray[np.float64],
    seq_b: npt.NDArray[np.float64],
    window: int,
) -> float:
    """Computes Sakoe-Chiba constrained DTW distance between two 3D trajectories."""
    ...