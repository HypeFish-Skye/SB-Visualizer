export type Vec3Tuple = [number, number, number];
export type Vec2Tuple = [number, number];

export type CameraMode = 'orbit' | 'chase' | 'duo' | 'overhead';
export type HeatmapMode = 'none' | 'speed' | 'curvature';
export type CorridorWidth = 'thin' | 'medium' | 'wide';
export type TableSide = 'left' | 'right';
export type CornerAngle = 45 | 90 | 135;

export interface RawSkeletonData {
  leader_markers?: Record<string, [number, number, number][]>;
  prop_markers?: Record<string, [number, number, number][]>;
}

export interface TelemetryData {
  leader_speed: number[];
  follower_speed: number[];
  separation: number[];
  follower_curvature: number[];
  commitment?: number[];
  hand_lift?: number[];
}

export interface Trajectories {
  leader: Vec3Tuple[];
  follower: Vec3Tuple[];
  accompanier: Vec3Tuple[];
  obstacle: Vec3Tuple[];
  prop?: Vec3Tuple[];
  rawSkeleton?: RawSkeletonData;
}

export interface TrajectoryResponse {
  leader: Vec3Tuple[];
  follower: Vec3Tuple[];
  accompanier?: Vec3Tuple[];
  obstacle?: Vec3Tuple[];
  prop_trajectory?: Vec3Tuple[];
  wall_plane?: WallPlaneData;
  telemetry: TelemetryData;
  raw_skeleton?: RawSkeletonData;
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

export interface WallPlaneData {
  center: [number, number, number];
  width: number;
  height: number;
  normal: [number, number, number];
  corners: [number, number, number][]; // [BL, BR, TR, TL]
}

export interface TrajectoryData {
  name: string;
  leader: [number, number, number][];
  follower: [number, number, number][];
  accompanier?: [number, number, number][];
  wall_plane?: WallPlaneData;
  prop_trajectory?: [number, number, number][];
  telemetry: any;
}