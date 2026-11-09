from typing import List, Optional, Tuple
from pydantic import BaseModel, Field

Vec3 = Tuple[float, float, float]

class RawSkeletonData(BaseModel):
    # marker_name -> [(x, y, z), ...] per frame in meters (Three.js coords)
    leader_markers: Optional[dict[str, list[list[float]]]] = Field(
        None, description="Per-frame 3D coordinates for each human marker"
    )
    prop_markers: Optional[dict[str, list[list[float]]]] = Field(
        None, description="Per-frame 3D coordinates for prop person markers (M_1..M_5)"
    )

class WallPlane(BaseModel):
    center: List[float]       # [x, y, z] center of the wall
    width: float              # Horizontal width in meters
    height: float             # Height in meters from floor
    normal: List[float]       # [nx, 0, nz] outward facing unit normal
    corners: List[List[float]] # 4 vertices [[x,y,z], ...] for the vertical quad

class TelemetryData(BaseModel):
    leader_speed: List[float] = Field(..., description="Leader linear velocity in m/s")
    follower_speed: List[float] = Field(..., description="Robot linear velocity in m/s")
    separation: List[float] = Field(..., description="Inter-agent Euclidean distance in meters")
    follower_curvature: List[float] = Field(..., description="Robot curvature in 1/m")
    commitment: Optional[List[float]] = Field(None, description="Wall approach commitment metric (0.0 to 1.0)")
    hand_lift: Optional[List[float]] = Field(None, description="Hand lift height above baseline in meters")


class TrajectoryResponse(BaseModel):
    leader: List[Vec3] = Field(default_factory=list)
    follower: List[Vec3] = Field(default_factory=list)
    accompanier: List[Vec3] = Field(default_factory=list)
    obstacle: List[Vec3] = Field(default_factory=list)
    telemetry: TelemetryData
    prop_trajectory: Optional[List[List[float]]] = None
    raw_skeleton: Optional[RawSkeletonData] = None  

class TrialMetadata(BaseModel):
    filename: str
    name: str
    study: str

class DTWMatch(BaseModel):
    filename: str
    name: str
    dtw_distance: float = Field(..., description="Sakoe-Chiba DTW warp distance")
    study: Optional[str] = Field(None, description="Intra-study category name")
