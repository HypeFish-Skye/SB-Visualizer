from typing import List, Optional, Tuple
from pydantic import BaseModel, Field

Vec3 = Tuple[float, float, float]

class TelemetryData(BaseModel):
    leader_speed: List[float] = Field(..., description="Leader linear velocity in m/s")
    follower_speed: List[float] = Field(..., description="Robot linear velocity in m/s")
    separation: List[float] = Field(..., description="Inter-agent Euclidean distance in meters")
    follower_curvature: List[float] = Field(..., description="Robot curvature in 1/m")


class TrajectoryResponse(BaseModel):
    leader: List[Vec3] = Field(default_factory=list)
    follower: List[Vec3] = Field(default_factory=list)
    accompanier: List[Vec3] = Field(default_factory=list)
    obstacle: List[Vec3] = Field(default_factory=list)
    telemetry: TelemetryData

class TrialMetadata(BaseModel):
    filename: str
    name: str
    study: str

class DTWMatch(BaseModel):
    filename: str
    name: str
    dtw_distance: float = Field(..., description="Sakoe-Chiba DTW warp distance")
    study: Optional[str] = Field(None, description="Intra-study category name")