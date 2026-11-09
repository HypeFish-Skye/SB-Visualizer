import numpy as np
import duckdb
import pandas as pd
import re
import os
from typing import List, Tuple, Optional
from smart_behaviors.api.schemas import TrajectoryResponse, TelemetryData, WallPlane, Vec3
from scipy.ndimage import gaussian_filter1d
from smart_behaviors.api.schemas import RawSkeletonData

MOCAP_FPS = 120.0
DT = 1.0 / MOCAP_FPS

# Hand lift settings
BASELINE_M = (2.5, 3.0)                  # usual hand height is read here, on the way in only
HAND_MARKERS = {"Left": ("LIHAND", "LOHAND"), "Right": ("RIHAND", "ROHAND")}
SIGMA_FRAMES = 60                        # sigma60 smoothing
MAX_GAP_FRAMES = 24                      # gaps up to 0.2 s are interpolated
MIN_MARKER_COVERAGE = 0.5                # a hand marker tracked less often than this is not used

# Commitment settings
ALIGNMENT_HORIZON_S = 0.25                            # look-ahead for the heading
MIN_ALIGNMENT_TRAVEL_M = 0.15 * ALIGNMENT_HORIZON_S   # "effectively stopped"
APPROACH_ALIGNMENT_WEIGHT = 0.75                      # direction 3 : 1 over pace
APPROACH_SPEED_WEIGHT = 1.0 - APPROACH_ALIGNMENT_WEIGHT
REFERENCE_APPROACH_SPEED_MPS = 1.0                    # pace term saturates here

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

    @classmethod
    def _extract_prop_trajectory(cls, df: pd.DataFrame, coord_scale: float = 1.0) -> Optional[List[List[float]]]:
        """
        Extracts prop person coordinates:
        1. Checks for 5 raw Vicon markers (Prop*:M_1..5), filtering out 0.0 unrecorded values.
        2. Checks for DynamicObject / DynamicObject01 feature columns.
        """
        cols = list(df.columns)

        # -----------------------------------------------------------------
        # Path A: Raw Vicon TRC Markers (e.g. PropAlyssa:M_1..5)
        # -----------------------------------------------------------------
        prop_cols = [c for c in cols if re.match(r"^Prop.*:M_[1-5]-[xyz]$", c, re.IGNORECASE)]
        if prop_cols:
            marker_data = []
            for i in range(1, 6):
                matches_x = [c for c in prop_cols if re.match(rf"^Prop.*:M_{i}-x$", c, re.IGNORECASE)]
                matches_y = [c for c in prop_cols if re.match(rf"^Prop.*:M_{i}-y$", c, re.IGNORECASE)]
                matches_z = [c for c in prop_cols if re.match(rf"^Prop.*:M_{i}-z$", c, re.IGNORECASE)]

                if matches_x and matches_y and matches_z:
                    # Convert to float array
                    mx = pd.to_numeric(df[matches_x[0]], errors="coerce").to_numpy(float) / 1000.0
                    my = pd.to_numeric(df[matches_z[0]], errors="coerce").to_numpy(float) / 1000.0  # Vicon Z -> Three.js Y (height)
                    mz = pd.to_numeric(df[matches_y[0]], errors="coerce").to_numpy(float) / 1000.0  # Vicon Y -> Three.js Z (depth)

                    # CRITICAL: Replace Vicon 0.0 unrecorded markers with NaN so they do not corrupt the centroid
                    untracked = (np.abs(mx) < 0.01) & (np.abs(my) < 0.01) & (np.abs(mz) < 0.01)
                    mx[untracked] = np.nan
                    my[untracked] = np.nan
                    mz[untracked] = np.nan

                    marker_data.append(np.column_stack([mx, my, mz]))

            if marker_data:
                stack = np.array(marker_data)  # shape: (5, N, 3)
                with np.errstate(invalid="ignore"):
                    # Mean over only the tracked markers in each frame
                    centroid = np.nanmean(stack, axis=0)

                # Fill any transient gaps across frames
                clean_df = pd.DataFrame(centroid).interpolate(limit=60).bfill().ffill().fillna(0.0)
                clean_arr = clean_df.to_numpy()

                # If height collapsed due to all-missing markers, default to standard standing elevation
                valid_y = clean_arr[:, 1] > 0.5
                default_y = float(np.median(clean_arr[valid_y, 1])) if np.any(valid_y) else 1.60
                clean_arr[~valid_y, 1] = default_y

                if np.any(clean_arr[:, 0] != 0.0) or np.any(clean_arr[:, 2] != 0.0):
                    return clean_arr.round(4).tolist()

        # -----------------------------------------------------------------
        # Path B: Processed Features Parquet (DynamicObject01 / DynamicObject)
        # -----------------------------------------------------------------
        px = cls._find_column(cols, [
            "PositionX_DynamicObject01_World",
            "PositionX_DynamicObject_World",
            "PositionX_DynamicObstacle01_World",
        ])
        py = cls._find_column(cols, [
            "PositionY_DynamicObject01_World",
            "PositionY_DynamicObject_World",
            "PositionY_DynamicObstacle01_World",
        ])
        if px and py:
            xs = pd.to_numeric(df[px], errors="coerce").ffill().bfill().fillna(0.0).to_numpy() / coord_scale
            zs = pd.to_numeric(df[py], errors="coerce").ffill().bfill().fillna(0.0).to_numpy() / coord_scale

            pz = cls._find_column(cols, [
                "PositionZ_DynamicObject01_World",
                "PositionZ_DynamicObject_World"
            ])
            if pz:
                ys = pd.to_numeric(df[pz], errors="coerce").ffill().bfill().fillna(1.60).to_numpy() / coord_scale
            else:
                ys = np.full_like(xs, 1.60)

            return np.column_stack([xs, ys, zs]).round(4).tolist()

        return None

    @classmethod
    def _compute_commitment(cls, df: pd.DataFrame, framerate: float = MOCAP_FPS) -> Optional[List[float]]:
        """
        Calculates wall approach commitment (0.0 to 1.0) per frame.
        Uses precomputed column if available, otherwise computes from distance and trajectory.
        """
        cols = list(df.columns)
        precomputed = cls._find_column(cols, [
            "WallApproachCommitment_Leader01",
            "WallApproachCommitment",
            "commitment"
        ])
        if precomputed:
            vals = df[precomputed].ffill().bfill().fillna(0.0).to_numpy(float)
            return np.nan_to_num(vals, nan=0.0).round(4).tolist()

        d_col = cls._find_column(cols, ["DistanceToWall_Leader01_World", "DistanceToWall_Individual01_World"])
        x_col = cls._find_column(cols, ["PositionX_Leader01_World", "PositionX_Individual01_World"])
        y_col = cls._find_column(cols, ["PositionY_Leader01_World", "PositionY_Individual01_World"])
        s_col = cls._find_column(cols, ["VelocityMagnitude_Leader01_World", "VelocityMagnitude_Individual01_World"])

        if not (d_col and x_col and y_col):
            return None

        d = pd.to_numeric(df[d_col], errors="coerce").ffill().bfill().to_numpy(float)
        x = pd.to_numeric(df[x_col], errors="coerce").ffill().bfill().to_numpy(float)
        y = pd.to_numeric(df[y_col], errors="coerce").ffill().bfill().to_numpy(float)
        speed = pd.to_numeric(df[s_col], errors="coerce").ffill().bfill().to_numpy(float) if s_col else np.zeros_like(d)

        # Scale from mm if necessary
        if np.nanmedian(np.abs(x)) > 30.0:
            d, x, y = d / 1000.0, x / 1000.0, y / 1000.0
        if np.nanmedian(np.abs(speed)) > 50.0:
            speed = speed / 1000.0

        step = max(int(round(ALIGNMENT_HORIZON_S * framerate)), 1)
        n = len(d)
        alignment = np.full(n, np.nan)
        stopped = np.zeros(n, dtype=bool)

        if n > step:
            closed = d[:-step] - d[step:]
            travelled = np.hypot(x[step:] - x[:-step], y[step:] - y[:-step])
            measurable = np.isfinite(closed) & np.isfinite(travelled)
            ok = measurable & (travelled >= MIN_ALIGNMENT_TRAVEL_M)
            alignment[:-step][ok] = np.maximum(closed[ok] / travelled[ok], 0.0)
            stopped[:-step] = measurable & ~ok

        with np.errstate(invalid="ignore"):
            pace = np.clip(speed / REFERENCE_APPROACH_SPEED_MPS, 0.0, 1.0)
            commitment = (alignment ** APPROACH_ALIGNMENT_WEIGHT) * (pace ** APPROACH_SPEED_WEIGHT)

        commitment[stopped] = 0.0
        return np.nan_to_num(commitment, nan=0.0).round(4).tolist()


    @classmethod
    def _extract_raw_vicon_skeleton(
        cls, cursor, file_path: str, max_frames: int
    ) -> Optional[RawSkeletonData]:
        """
        Locates the raw Vicon parquet file in S3, parses all human markers (53 channels)
        and prop person markers (5 channels), mapping them to Three.js coordinates (meters).
        """
        raw_df = None
        base_name = os.path.basename(file_path)

        # 1. Check if the current file itself already contains raw marker columns
        try:
            check_df = cursor.execute(f"SELECT * FROM read_parquet('{file_path}') LIMIT 2;").df()
            if any(":" in c for c in check_df.columns):
                raw_df = cursor.execute(f"SELECT * FROM read_parquet('{file_path}');").df()
        except Exception:
            pass

        # 2. If not, resolve from the Raw S3 bucket path
        if raw_df is None:
            raw_s3_url = f"s3://smart-behaviors-database/Raw/ReadingWallIntentions/{base_name}"
            try:
                raw_df = cursor.execute(f"SELECT * FROM read_parquet('{raw_s3_url}');").df()
            except Exception:
                # Fallback: check with wildcard pattern
                try:
                    stem = base_name.replace(".parquet", "")
                    wildcard = f"s3://smart-behaviors-database/Raw/ReadingWallIntentions/*{stem}*.parquet"
                    raw_df = cursor.execute(f"SELECT * FROM read_parquet('{wildcard}') LIMIT 1;").df()
                except Exception:
                    return None

        if raw_df is None or raw_df.empty:
            return None

        cols = list(raw_df.columns)

        # 3. Identify human participant namespace (e.g. "Ben", "Isa", "Eleni")
        names = sorted({c.split(":")[0] for c in cols if ":" in c})
        human_names = [n for n in names if not n.startswith("Prop") and n not in ["Cart", "Wagon", "Wall"]]
        if not human_names:
            return None

        walker = human_names[0]

        # 4. Extract 53 Leader markers
        leader_markers: dict[str, list[list[float]]] = {}
        for c in cols:
            if c.startswith(f"{walker}:") and c.endswith("-x"):
                marker_name = c[len(walker) + 1 : -2]  # Extract marker name (e.g. "ARIEL", "C7")
                mx = f"{walker}:{marker_name}-x"
                my = f"{walker}:{marker_name}-y"
                mz = f"{walker}:{marker_name}-z"

                if mx in cols and my in cols and mz in cols:
                    # Vicon mm -> Three.js meters: X -> X, Z -> Y (height), Y -> Z (depth)
                    xs = pd.to_numeric(raw_df[mx], errors="coerce").interpolate(limit=24).bfill().ffill().to_numpy() / 1000.0
                    ys = pd.to_numeric(raw_df[mz], errors="coerce").interpolate(limit=24).bfill().ffill().to_numpy() / 1000.0
                    zs = pd.to_numeric(raw_df[my], errors="coerce").interpolate(limit=24).bfill().ffill().to_numpy() / 1000.0

                    coords = np.column_stack([xs, ys, zs]).round(4).tolist()
                    leader_markers[marker_name] = coords[:max_frames]

        # 5. Extract 5 Prop Person markers (e.g. PropAlyssa:M_1..5)
        prop_markers: dict[str, list[list[float]]] = {}
        prop_namespaces = [n for n in names if n.startswith("Prop")]
        if prop_namespaces:
            prop_who = prop_namespaces[0]
            for i in range(1, 6):
                pmx = f"{prop_who}:M_{i}-x"
                pmy = f"{prop_who}:M_{i}-y"
                pmz = f"{prop_who}:M_{i}-z"
                if pmx in cols and pmy in cols and pmz in cols:
                    pxs = pd.to_numeric(raw_df[pmx], errors="coerce").interpolate(limit=24).bfill().ffill().to_numpy() / 1000.0
                    pys = pd.to_numeric(raw_df[pmz], errors="coerce").interpolate(limit=24).bfill().ffill().to_numpy() / 1000.0
                    pzs = pd.to_numeric(raw_df[pmy], errors="coerce").interpolate(limit=24).bfill().ffill().to_numpy() / 1000.0

                    # Only register if tracked
                    if np.nanmax(np.abs(pxs)) > 0.05:
                        pcoords = np.column_stack([pxs, pys, pzs]).round(4).tolist()
                        prop_markers[f"M_{i}"] = pcoords[:max_frames]

        return RawSkeletonData(
            leader_markers=leader_markers if leader_markers else None,
            prop_markers=prop_markers if prop_markers else None,
        )

    @classmethod
    def _compute_hand_lift(cls, df: pd.DataFrame) -> Optional[List[float]]:
        """
        Calculates hand lift in meters per frame:
        Smoothed hand height referenced against the 2.5m-3.0m approach baseline.
        """
        cols = list(df.columns)
        precomputed = cls._find_column(cols, ["hand_lift_m", "HandLift_Leader01_m", "HandReach_Leader01_m"])
        if precomputed:
            vals = df[precomputed].ffill().bfill().fillna(0.0).to_numpy(float)
            return np.nan_to_num(vals, nan=0.0).round(4).tolist()

        # Check for raw hand marker columns
        names = sorted({c.split(":")[0] for c in cols if ":" in c})
        people = [
            n for n in names
            if not n.startswith("Prop")
            and any(f"{n}:{m}-z" in cols for pair in HAND_MARKERS.values() for m in pair)
        ]
        if not people:
            return None

        who = people[0]

        # Resolve distance along approach corridor
        x_col = cls._find_column(cols, ["PositionX_Leader01_WallCenter", "DistanceToWall_Leader01_World"])
        if x_col:
            x = pd.to_numeric(df[x_col], errors="coerce").to_numpy(float)
        else:
            x = np.linspace(3.5, 0.0, len(df))

        crossed = np.flatnonzero(x <= 0)
        end = int(crossed[0]) if len(crossed) else int(np.nanargmin(x))
        usual = (x >= BASELINE_M[0]) & (x <= BASELINE_M[1]) & (np.arange(len(x)) <= end)
        if not usual.any():
            usual = np.arange(len(x)) < max(int(0.2 * end), 10)

        def get_smoothed_height(marker: str) -> np.ndarray:
            z = pd.to_numeric(df[f"{marker}-z"], errors="coerce") / 1000.0
            z = z.interpolate(limit=MAX_GAP_FRAMES, limit_area="inside").ffill().bfill().to_numpy()
            return gaussian_filter1d(z, sigma=SIGMA_FRAMES, mode="nearest")

        lifts = []
        for markers in HAND_MARKERS.values():
            present = [f"{who}:{m}" for m in markers if f"{who}:{m}-z" in cols]
            if present:
                hand = np.mean([get_smoothed_height(m) for m in present], axis=0)
                lifts.append(hand - np.median(hand[usual]))

        if lifts:
            combined = np.max(np.column_stack(lifts), axis=1)
            return np.nan_to_num(combined, nan=0.0).round(4).tolist()

        return None
    
    @classmethod
    def load_trajectory(cls, cursor: duckdb.DuckDBPyConnection, file_path: str,
                        include_raw: bool) -> TrajectoryResponse:
        df = cursor.execute(f"SELECT * FROM read_parquet('{file_path}');").df()
        cols = list(df.columns)

        # -------------------------------------------------------------
        # 1. RAW / WORLD COORDINATE EXTRACTION
        # -------------------------------------------------------------
        # Follower (Robot / Cart)
        foll_data = cls._extract_world_coords(df, [
            "Follower01", "Follower", "Individual02", "Robot01", "Robot", "Gita", "Cart01", "Cart"
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

        # Leader (Primary Human)
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

        # Prop Person (DynamicObject01 / DynamicObject)
        prop_data = cls._extract_world_coords(df, [
            "DynamicObject01", "DynamicObject", "PropPerson01", "PropPerson", "Prop01", "Prop"
        ])
        if prop_data is None and foll_data is not None:
            rel_px = cls._find_column(cols, [
                "RelativePositionX_DynamicObject01Follower01_Follower01Allocentric",
                "RelativePositionX_DynamicObjectFollower01_Follower01Allocentric"
            ])
            rel_py = cls._find_column(cols, [
                "RelativePositionY_DynamicObject01Follower01_Follower01Allocentric",
                "RelativePositionY_DynamicObjectFollower01_Follower01Allocentric"
            ])
            if rel_px and rel_py:
                dpx = df[rel_px].ffill().bfill().fillna(0.0).to_numpy()
                dpy = df[rel_py].ffill().bfill().fillna(0.0).to_numpy()
                prop_data = (foll_data[0] + dpx, foll_data[1] + dpy)

        # Accompanier (Accompanier01)
        acc_data = cls._extract_world_coords(df, ["Accompanier01", "Accompanier"])
        if acc_data is None and foll_data is not None:
            rel_ax = cls._find_column(cols, ["RelativePositionX_Accompanier01Follower01_Follower01Allocentric"])
            rel_ay = cls._find_column(cols, ["RelativePositionY_Accompanier01Follower01_Follower01Allocentric"])
            if rel_ax and rel_ay:
                dax = df[rel_ax].ffill().bfill().fillna(0.0).to_numpy()
                day = df[rel_ay].ffill().bfill().fillna(0.0).to_numpy()
                acc_data = (foll_data[0] + dax, foll_data[1] + day)

        # Static / Dynamic Obstacles
        obs_data = cls._extract_world_coords(df, [
            "DynamicObstacle01", "Obstacle01", "Obstacle", "Box01", "Box"
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
        max_coord_val = 0.0
        for data in [foll_data, lead_data, prop_data, acc_data, obs_data]:
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

        # Convert prop person coordinates to Vec3 with height for the floating orb
        prop_trajectory = None
        if prop_data is not None:
            prop_xs = prop_data[0] / coord_scale
            prop_zs = prop_data[1] / coord_scale
            # Check if Z height column exists in features (e.g. PositionZ_DynamicObject01_World)
            pz_col = cls._find_column(cols, ["PositionZ_DynamicObject01_World", "PositionZ_DynamicObject_World"])
            if pz_col:
                prop_ys = df[pz_col].ffill().bfill().fillna(0.0).to_numpy() / coord_scale
            else:
                # Default floating orb elevation at human head/chest level
                prop_ys = np.full_like(prop_xs, 1.55)
            prop_trajectory = np.column_stack([prop_xs, prop_ys, prop_zs]).round(4).tolist()
        else:
            # Fallback to raw marker extraction if raw TRC/Parquet file was loaded
            prop_trajectory = cls._extract_prop_trajectory(df)

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

        # 3e. Commitment (0.0 to 1.0)
        commitment = cls._compute_commitment(df) or [0.0] * n

        # 3f. Hand lift (meters)
        hand_lift = cls._compute_hand_lift(df) or [0.0]

        telemetry = TelemetryData(
            leader_speed=lead_speed,
            follower_speed=foll_speed,
            separation=separation,
            follower_curvature=foll_curv,
            commitment=commitment,
            hand_lift=hand_lift
        )
        
        prop_trajectory = cls._extract_prop_trajectory(df)

        raw_skeleton = None
        if include_raw or "readingwall" in file_path.lower():
            raw_skeleton = cls._extract_raw_vicon_skeleton(cursor, file_path, max_frames=n)

        return TrajectoryResponse(
            leader=leader_coords,
            follower=follower_coords,
            accompanier=accompanier_coords,
            obstacle=obstacle_coords,
            telemetry=telemetry,
            prop_trajectory=prop_trajectory,
            raw_skeleton=raw_skeleton
        )