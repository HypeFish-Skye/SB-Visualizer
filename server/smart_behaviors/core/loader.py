import numpy as np
import duckdb
import pandas as pd
import re
from typing import List, Tuple, Optional
from smart_behaviors.api.schemas import TrajectoryResponse, TelemetryData, WallPlane, Vec3

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
    def _extract_world_coords(cls, df, aliases: List[str]) -> Optional[Tuple[np.ndarray, np.ndarray]]:
        """Extracts planar X and Y when standard Position*_World columns exist."""
        cols = list(df.columns)
        for alias in aliases:
            x_col = cls._find_column(cols, [f"PositionX_{alias}_World", f"{alias}_x", f"Pos_X_{alias}"])
            y_col = cls._find_column(cols, [f"PositionY_{alias}_World", f"{alias}_y", f"Pos_Y_{alias}"])
            if x_col and y_col:
                xs = df[x_col].ffill().bfill().fillna(0.0).to_numpy()
                ys = df[y_col].ffill().bfill().fillna(0.0).to_numpy()
                return xs, ys
        return None

    @classmethod
    def _to_vec3_list(cls, xs: np.ndarray, ys: np.ndarray, scale: float = 1.0) -> List[Vec3]:
        """Maps MoCap (X, Y) to Three.js floor plane (X, Y=0.02, Z) scaled to meters."""
        return [(float(x / scale), 0.02, float(y / scale)) for x, y in zip(xs, ys)]

    @classmethod
    def _normalize_speed(cls, speed_raw: np.ndarray, coords: List[Vec3], default_scale: float = 1.0) -> List[float]:
        """Normalizes speeds to m/s, handling mm/s, cm/s, and finite difference fallbacks."""
        n = len(coords)
        if len(speed_raw) == 0 or np.all(speed_raw == 0):
            if n <= 1:
                return [0.0] * n
            pos = np.array([[c[0], c[2]] for c in coords])
            diff = np.diff(pos, axis=0) / DT
            speeds_derived = np.linalg.norm(diff, axis=1)
            speeds_derived = np.insert(speeds_derived, 0, speeds_derived[0])
            return speeds_derived.round(4).tolist()

        raw_med = float(np.nanmedian(np.abs(speed_raw)))

        # Human & Gita speeds in m/s never exceed 20 m/s in a mocap lab.
        # If coordinates were in mm (default_scale == 1000.0) or raw speed > 50.0, convert to m/s:
        if default_scale == 1000.0 or raw_med > 50.0:
            if raw_med > 300.0 or default_scale == 1000.0:
                speed_m_s = speed_raw / 1000.0  # mm/s -> m/s
            elif raw_med > 25.0:
                speed_m_s = speed_raw / 100.0   # cm/s -> m/s
            else:
                speed_m_s = speed_raw
        else:
            speed_m_s = speed_raw

        return np.nan_to_num(speed_m_s, nan=0.0).round(4).tolist()


    @staticmethod
    def _extract_wall_plane(df: pd.DataFrame) -> Optional[WallPlane]:
        """Detects Wall:M_1 through Wall:M_7 markers and generates a vertical plane quad."""
        wall_cols = [c for c in df.columns if c.startswith("Wall:M_")]
        if not wall_cols:
            return None

        # Extract median 3D positions for all 7 wall markers
        marker_points = []
        for i in range(1, 8):
            x_col = f"Wall:M_{i}-x"
            y_col = f"Wall:M_{i}-y"
            z_col = f"Wall:M_{i}-z"
            if x_col in df and y_col in df and z_col in df:
                # Vicon units (mm) -> Three.js (m): X -> X, Z -> Y (height), Y -> Z
                x = df[x_col].median() / 1000.0
                y = df[z_col].median() / 1000.0
                z = df[y_col].median() / 1000.0
                if not (np.isnan(x) or np.isnan(y) or np.isnan(z)):
                    marker_points.append([x, y, z])

        if len(marker_points) < 3:
            return None

        pts = np.array(marker_points)
        x_coords = pts[:, 0]
        y_coords = pts[:, 1]
        z_coords = pts[:, 2]

        # 2D PCA on horizontal plane (X, Z) to find wall orientation line
        xz = pts[:, [0, 2]]
        xz_center = np.mean(xz, axis=0)
        xz_centered = xz - xz_center
        cov = np.cov(xz_centered, rowvar=False)
        eigenvalues, eigenvectors = np.linalg.eigh(cov)
        tangent_2d = eigenvectors[:, np.argmax(eigenvalues)]  # Principal axis vector
        normal_2d = np.array([-tangent_2d[1], tangent_2d[0]])

        # Horizontal projected span along the wall tangent
        projections = np.dot(xz_centered, tangent_2d)
        min_proj, max_proj = np.min(projections), np.max(projections)
        width = float(max_proj - min_proj)

        # Height span (flush from floor Y=0 up to top marker)
        max_height = float(np.max(y_coords))
        height = max(max_height, 2.0)

        # 3D corners: BL, BR, TR, TL
        center_x, center_z = xz_center[0], xz_center[1]
        p_left = xz_center + min_proj * tangent_2d
        p_right = xz_center + max_proj * tangent_2d

        corners = [
            [round(float(p_left[0]), 4), 0.0, round(float(p_left[1]), 4)],          # Bottom-Left
            [round(float(p_right[0]), 4), 0.0, round(float(p_right[1]), 4)],         # Bottom-Right
            [round(float(p_right[0]), 4), round(height, 4), round(float(p_right[1]), 4)], # Top-Right
            [round(float(p_left[0]), 4), round(height, 4), round(float(p_left[1]), 4)]   # Top-Left
        ]

        return WallPlane(
            center=[round(float(center_x), 4), round(height / 2.0, 4), round(float(center_z), 4)],
            width=round(width, 4),
            height=round(height, 4),
            normal=[round(float(normal_2d[0]), 4), 0.0, round(float(normal_2d[1]), 4)],
            corners=corners
        )

    @staticmethod
    def _extract_prop_trajectory(df: pd.DataFrame) -> Optional[List[List[float]]]:
        """Detects 5 prop individual markers (e.g. PropAlyssa:M_1..5) and computes centroid."""
        # Regex matches PropAlyssa:M_1-x, PropPerson:M_2-y, Prop:M_3-z, etc.
        prop_cols = [c for c in df.columns if re.match(r"^Prop.*:M_[1-5]-[xyz]$", c, re.IGNORECASE)]
        if not prop_cols:
            return None

        # Group by marker index 1..5
        marker_data = []
        for i in range(1, 6):
            matches_x = [c for c in prop_cols if re.match(rf"^Prop.*:M_{i}-x$", c, re.IGNORECASE)]
            matches_y = [c for c in prop_cols if re.match(rf"^Prop.*:M_{i}-y$", c, re.IGNORECASE)]
            matches_z = [c for c in prop_cols if re.match(rf"^Prop.*:M_{i}-z$", c, re.IGNORECASE)]

            if matches_x and matches_y and matches_z:
                # mm -> meters, mapped to Three.js (X->X, Z->Y, Y->Z)
                mx = df[matches_x[0]].to_numpy() / 1000.0
                my = df[matches_z[0]].to_numpy() / 1000.0
                mz = df[matches_y[0]].to_numpy() / 1000.0
                marker_data.append(np.column_stack([mx, my, mz]))

        if not marker_data:
            return None

        # Compute centroid across available markers per frame (shape: N, 3)
        marker_stack = np.array(marker_data)  # (5, N, 3)
        with np.errstate(invalid='ignore'):
            prop_centroid = np.nanmean(marker_stack, axis=0)

        # Forward/backward fill any transient occlusion dropouts
        prop_df = pd.DataFrame(prop_centroid).ffill().bfill().fillna(0.0)
        return prop_df.to_numpy().round(4).tolist()
    
    @classmethod
    def load_trajectory(cls, cursor: duckdb.DuckDBPyConnection, file_path: str) -> TrajectoryResponse:
        df = cursor.execute(f"SELECT * FROM read_parquet('{file_path}');").df()
        cols = list(df.columns)

        # -------------------------------------------------------------
        # 1. RAW COORDINATE EXTRACTION
        # -------------------------------------------------------------
        # Follower (Gita)
        foll_data = cls._extract_world_coords(df, [
            "Follower01", "Follower", "Individual02", "Robot01", "Robot", "Gita"
        ])
        if foll_data is None:
            fx_col = cls._find_column(cols, [
                "RelativePositionX_Follower01_Follower01Allocentric",
                "RelativePositionX_Follower_Allocentric"
            ])
            fy_col = cls._find_column(cols, [
                "RelativePositionY_Follower01_Follower01Allocentric",
                "RelativePositionY_Follower_Allocentric"
            ])
            if fx_col and fy_col:
                xs = df[fx_col].ffill().bfill().fillna(0.0).to_numpy()
                ys = df[fy_col].ffill().bfill().fillna(0.0).to_numpy()
                foll_data = (xs, ys)

        # Leader
        lead_data = cls._extract_world_coords(df, [
            "Leader01", "Leader", "Individual01", "Person01", "Person"
        ])
        if lead_data is None and foll_data is not None:
            rel_lx = cls._find_column(cols, ["RelativePositionX_Leader01Follower01_Follower01Allocentric"])
            rel_ly = cls._find_column(cols, ["RelativePositionY_Leader01Follower01_Follower01Allocentric"])
            if rel_lx and rel_ly:
                dx = df[rel_lx].ffill().bfill().fillna(0.0).to_numpy()
                dy = df[rel_ly].ffill().bfill().fillna(0.0).to_numpy()
                lead_data = (foll_data[0] + dx, foll_data[1] + dy)

        # Accompanier
        acc_data = cls._extract_world_coords(df, ["Accompanier01", "Accompanier"])
        if acc_data is None and foll_data is not None:
            rel_ax = cls._find_column(cols, [
                "RelativePositionX_DynamicObject01Follower01_Follower01Allocentric",
                "RelativePositionX_Accompanier01Follower01_Follower01Allocentric"
            ])
            rel_ay = cls._find_column(cols, [
                "RelativePositionY_DynamicObject01Follower01_Follower01Allocentric",
                "RelativePositionY_Accompanier01Follower01_Follower01Allocentric"
            ])
            if rel_ax and rel_ay:
                dax = df[rel_ax].ffill().bfill().fillna(0.0).to_numpy()
                day = df[rel_ay].ffill().bfill().fillna(0.0).to_numpy()
                acc_data = (foll_data[0] + dax, foll_data[1] + day)

        # Obstacles & Props
        obs_data = cls._extract_world_coords(df, [
            "DynamicObstacle01", "Obstacle01", "Obstacle",
            "Cart01", "Cart", "Box01", "Box", "Prop01", "Prop"
        ])
        if obs_data is None and foll_data is not None:
            rel_ox = cls._find_column(cols, [
                "RelativePositionX_DynamicObstacle01Follower01_Follower01Allocentric",
                "RelativePositionX_Obstacle01Follower01_Follower01Allocentric"
            ])
            rel_oy = cls._find_column(cols, [
                "RelativePositionY_DynamicObstacle01Follower01_Follower01Allocentric",
                "RelativePositionY_Obstacle01Follower01_Follower01Allocentric"
            ])
            if rel_ox and rel_oy:
                dox = df[rel_ox].ffill().bfill().fillna(0.0).to_numpy()
                doy = df[rel_oy].ffill().bfill().fillna(0.0).to_numpy()
                obs_data = (foll_data[0] + dox, foll_data[1] + doy)

        # -------------------------------------------------------------
        # 2. AUTO-DETECT UNIT SCALE (Millimeters vs Meters)
        # -------------------------------------------------------------
        # In a ~20m MoCap arena, valid meters are < 25.0m.
        # If coordinates exceed 30.0, the pipeline exported in millimeters.
        max_coord_val = 0.0
        for data in [foll_data, lead_data, acc_data, obs_data]:
            if data is not None:
                max_coord_val = max(
                    max_coord_val,
                    float(np.nanmax(np.abs(data[0]))),
                    float(np.nanmax(np.abs(data[1])))
                )

        coord_scale = 1000.0 if max_coord_val > 30.0 else 1.0

        follower_coords = cls._to_vec3_list(*foll_data, scale=coord_scale) if foll_data is not None else []
        leader_coords = cls._to_vec3_list(*lead_data, scale=coord_scale) if lead_data is not None else []
        accompanier_coords = cls._to_vec3_list(*acc_data, scale=coord_scale) if acc_data is not None else []
        obstacle_coords = cls._to_vec3_list(*obs_data, scale=coord_scale) if obs_data is not None else []

        # -------------------------------------------------------------
        # 3. KINEMATIC TELEMETRY
        # -------------------------------------------------------------
        n = max(len(leader_coords), len(follower_coords), len(accompanier_coords), len(obstacle_coords), len(df))

        # 3a. Separation (also scale if in millimeters)
        sep_col = cls._find_column(cols, [
            "SeparationDistance_Leader01Follower01_World",
            "DistanceX_Individual01Invidual02_GoalOriented",
            "separation"
        ])
        if sep_col:
            sep_raw = df[sep_col].ffill().bfill().fillna(0.0).abs().to_numpy()
            sep_scale = 1000.0 if float(np.nanmedian(sep_raw)) > 30.0 else 1.0
            separation = (sep_raw / sep_scale).round(4).tolist()
        elif len(leader_coords) > 0 and len(follower_coords) > 0:
            lnp = np.array(leader_coords)
            fnp = np.array(follower_coords)
            min_len = min(len(lnp), len(fnp))
            separation = np.linalg.norm(lnp[:min_len] - fnp[:min_len], axis=1).round(4).tolist()
        else:
            separation = [0.0] * n

        # 3b. Leader speed
        ls_col = cls._find_column(cols, [
            "VelocityMagnitude_Leader01_World",
            "ScalarVelocity_Leader01_World",
            "VelocityMagnitude_Individual01_World"
        ])
        raw_lead_speed = df[ls_col].ffill().bfill().fillna(0.0).to_numpy() if ls_col else np.array([])
        lead_speed = cls._normalize_speed(raw_lead_speed, leader_coords, default_scale=coord_scale)

        # 3c. Follower speed
        fs_col = cls._find_column(cols, [
            "VelocityMagnitude_Follower01_World",
            "ScalarVelocity_Follower01_World",
            "VelocityMagnitude_Individual02_World"
        ])
        raw_foll_speed = df[fs_col].ffill().bfill().fillna(0.0).to_numpy() if fs_col else np.array([])
        foll_speed = cls._normalize_speed(raw_foll_speed, follower_coords, default_scale=coord_scale)

        # 3d. Follower Curvature (kappa)
        curv_col = cls._find_column(cols, [
            "Curvature_Follower01_World",
            "AbsoluteCurvature_Follower01_World"
        ])
        if curv_col:
            curv_raw = df[curv_col].ffill().bfill().fillna(0.0).to_numpy()
            # If curvature was calculated from mm coordinates, kappa is in 1/mm; convert to 1/m
            if float(np.nanmedian(np.abs(curv_raw))) < 0.005 and coord_scale == 1000.0:
                curv_raw = curv_raw * 1000.0
            foll_curv = curv_raw.round(4).tolist()
        else:
            foll_curv = [0.0] * n

        telemetry = TelemetryData(
            leader_speed=lead_speed,
            follower_speed=foll_speed,
            separation=separation,
            follower_curvature=foll_curv,
        )

        wall_plane = cls._extract_wall_plane(df)
        prop_trajectory = cls._extract_prop_trajectory(df)

        return TrajectoryResponse(
            leader=leader_coords,
            follower=follower_coords,
            accompanier=accompanier_coords,
            obstacle=obstacle_coords,
            telemetry=telemetry,
            wall_plane=wall_plane,
            prop_trajectory=prop_trajectory
        )