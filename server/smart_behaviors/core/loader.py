import numpy as np
import duckdb
from typing import List, Tuple, Dict, Any, Optional
from smart_behaviors.api.schemas import TrajectoryResponse, TelemetryData, Vec3

MOCAP_FPS = 120.0
DT = 1.0 / MOCAP_FPS


class TrajectoryLoader:
    @staticmethod
    def _find_column(df_cols: List[str], candidates: List[str]) -> Optional[str]:
        """Case-insensitive column resolution."""
        col_map = {col.lower(): col for col in df_cols}
        for cand in candidates:
            if cand.lower() in col_map:
                return col_map[cand.lower()]
        return None

    @classmethod
    def _extract_coords(cls, df, agent_prefix: str, ground_to_floor: bool = True) -> List[Vec3]:
        """
        Maps Vicon MoCap coordinates to Three.js space:
          - Vicon X (lateral floor)      -> Three.js X
          - Vicon Y (longitudinal floor) -> Three.js Z
          - Vicon Z (vertical marker)    -> Three.js Y (or clamped to floor level)
        """
        cols = list(df.columns)
        
        # Candidate prefixes for agents
        aliases = [agent_prefix, f"{agent_prefix}01", f"{agent_prefix}_01"]
        if agent_prefix.lower() == "follower":
            aliases.extend(["Follower01", "Follower", "Robot", "Robot01", "Gita"])
        elif agent_prefix.lower() == "leader":
            aliases.extend(["Leader01", "Leader", "Person", "Person01"])
        elif agent_prefix.lower() == "accompanier":
            aliases.extend(["Accompanier01", "Accompanier"])
        elif agent_prefix.lower() == "obstacle":
            aliases.extend(["Obstacle01", "Obstacle"])

        x_col = y_col = z_col = None
        for alias in aliases:
            x_cand = cls._find_column(cols, [f"PositionX_{alias}_World", f"{alias}_x", f"Pos_X_{alias}"])
            y_cand = cls._find_column(cols, [f"PositionY_{alias}_World", f"{alias}_y", f"Pos_Y_{alias}"])
            z_cand = cls._find_column(cols, [f"PositionZ_{alias}_World", f"{alias}_z", f"Pos_Z_{alias}"])

            if x_cand and y_cand and z_cand:
                x_col, y_col, z_col = x_cand, y_cand, z_cand
                break

        if not x_col or not y_col or not z_col:
            return []

        df_clean = df[[x_col, y_col, z_col]].ffill().bfill().fillna(0.0)
        xs = df_clean[x_col].to_numpy()
        ys = df_clean[y_col].to_numpy()
        zs = df_clean[z_col].to_numpy()

        # 1. Deterministic Horizontal Coordinate Mapping
        # MoCap X -> Three.js X
        # MoCap Y -> Three.js Z
        three_x = xs
        three_z = ys

        # 2. Floor Plane Elevation
        # PedestrianMesh and RobotFbxMesh have ground rings and geometries built
        # assuming position is at the floor (Y = 0.02m) to avoid z-fighting.
        if ground_to_floor:
            three_y = np.full_like(xs, 0.02)
        else:
            # Preserve raw marker height if specifically requested (never swap with Y)
            three_y = zs

        return [
            (float(x), float(y), float(z))
            for x, y, z in zip(three_x, three_y, three_z)
        ]

    @classmethod
    def _extract_telemetry(cls, df, leader_coords: List[Vec3], follower_coords: List[Vec3]) -> TelemetryData:
        """Extracts precomputed kinematic features from Parquet columns."""
        cols = list(df.columns)
        n = max(len(leader_coords), len(follower_coords), len(df))

        # 1. Separation Distance
        sep_col = cls._find_column(cols, [
            "SeparationDistance_Leader01Follower01_World",
            "SeparationDistance_LeaderFollower_World",
            "separation"
        ])
        if sep_col:
            separation = df[sep_col].ffill().bfill().fillna(0.0).round(4).tolist()
        else:
            lead_np = np.array(leader_coords) if leader_coords else np.zeros((n, 3))
            foll_np = np.array(follower_coords) if follower_coords else np.zeros((n, 3))
            separation = np.linalg.norm(lead_np - foll_np, axis=1).round(4).tolist()

        # 2. Leader Velocity Magnitude
        ls_col = cls._find_column(cols, ["VelocityMagnitude_Leader01_World", "VelocityMagnitude_Leader_World"])
        if ls_col:
            lead_speed = df[ls_col].ffill().bfill().fillna(0.0).round(4).tolist()
        else:
            lead_speed = [0.0] * n

        # 3. Follower Velocity Magnitude
        fs_col = cls._find_column(cols, ["VelocityMagnitude_Follower01_World", "VelocityMagnitude_Follower_World"])
        if fs_col:
            foll_speed = df[fs_col].ffill().bfill().fillna(0.0).round(4).tolist()
        else:
            foll_speed = [0.0] * n

        # 4. Follower Curvature (kappa)
        curv_col = cls._find_column(cols, [
            "Curvature_Follower01_World",
            "AbsoluteCurvature_Follower01_World",
            "Curvature_Follower_World"
        ])
        if curv_col:
            foll_curv = df[curv_col].ffill().bfill().fillna(0.0).round(4).tolist()
        else:
            foll_curv = [0.0] * n

        return TelemetryData(
            leader_speed=lead_speed,
            follower_speed=foll_speed,
            separation=separation,
            follower_curvature=foll_curv,
        )

    @classmethod
    def load_trajectory(cls, cursor: duckdb.DuckDBPyConnection, file_path: str) -> TrajectoryResponse:
        df = cursor.execute(f"SELECT * FROM read_parquet('{file_path}');").df()

        # Extract agents projected onto the arena floor plane
        leader = cls._extract_coords(df, "Leader", ground_to_floor=True)
        follower = cls._extract_coords(df, "Follower", ground_to_floor=True)
        accompanier = cls._extract_coords(df, "Accompanier", ground_to_floor=True)
        obstacle = cls._extract_coords(df, "Obstacle", ground_to_floor=True)

        telemetry = cls._extract_telemetry(df, leader, follower)

        return TrajectoryResponse(
            leader=leader,
            follower=follower,
            accompanier=accompanier,
            obstacle=obstacle,
            telemetry=telemetry,
        )