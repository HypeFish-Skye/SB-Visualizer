export type Vec3Tuple = [number, number, number];
export type Vec2Tuple = [number, number];

export type CameraMode = 'orbit' | 'chase' | 'duo' | 'overhead';
export type HeatmapMode = 'none' | 'speed' | 'curvature';
export type CorridorWidth = 'thin' | 'medium' | 'wide';
export type TableSide = 'left' | 'right';
export type CornerAngle = 45 | 90 | 135;

export interface TelemetryData {
  leader_speed: number[];
  follower_speed: number[];
  separation: number[];
  follower_curvature: number[];
}

export interface Trajectories {
  leader: Vec3Tuple[];
  follower: Vec3Tuple[];
  accompanier: Vec3Tuple[];
  obstacle: Vec3Tuple[];
}

export interface TrajectoryResponse {
  leader: Vec3Tuple[];
  follower: Vec3Tuple[];
  accompanier?: Vec3Tuple[];
  obstacle?: Vec3Tuple[];
  telemetry: TelemetryData;
}

export interface TrialMetadata {
  filename: string;
  name?: string;
  study?: string;
}

export interface DTWMatch {
  filename: string;
  name: string;
  dtw_distance: number;
}

export interface DTWOverlayData extends DTWMatch {
  coords: Vec3Tuple[];
}

export interface OvertakingConfig {
  corridorWidth: CorridorWidth;
  isNarrow: boolean;
  side: TableSide;
}