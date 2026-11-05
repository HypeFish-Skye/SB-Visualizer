import numpy as np
import numpy.typing as npt

def dtw_sakoe_chiba_3d(
    trajectory_a: npt.NDArray[np.float64],
    trajectory_b: npt.NDArray[np.float64],
    window: int = 50,
) -> float: ...

def compute_dtw(
    trajectory_a: npt.NDArray[np.float64],
    trajectory_b: npt.NDArray[np.float64],
    radius: int = 50,
) -> float: ...

def compute_batch_kinematics(
    trajectory_matrix: npt.NDArray[np.float64],
) -> npt.NDArray[np.float64]: ...

def simulate_robot_pursuit(
    leader_coords: npt.NDArray[np.float64],
    target_follow_dist: float,
    robot_max_speed: float,
) -> npt.NDArray[np.float64]: ...