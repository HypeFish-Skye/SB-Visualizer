import { create } from 'zustand';
import {
  CameraMode,
  CornerAngle,
  DTWMatch,
  DTWOverlayData,
  HeatmapMode,
  OvertakingConfig,
  RawSkeletonData,
  TelemetryData,
  Trajectories,
  TrajectoryResponse,
  TrialMetadata,
} from '../types/types.js';

const API_BASE = 'http://localhost:8000/api';

interface PlaybackState {
  // Scenario & Dataset Selection
  studies: string[];
  selectedStudy: string;
  trials: TrialMetadata[];
  selectedFile: string;
  loading: boolean;
  searching: boolean;
  rawSkeleton: RawSkeletonData | null;
  useRawRig: boolean,

  // Active Trajectories & Kinematics
  trajectories: Trajectories;
  telemetry: TelemetryData | null;
  matches: DTWMatch[];
  matchTrajectories: DTWOverlayData[];

  // Playback Clock
  isPlaying: boolean;
  currentFrame: number;
  fps: number;

  // Viewport Settings
  cameraMode: CameraMode;
  heatmapMode: HeatmapMode;

  // Derived Helpers
  getCornerAngle: () => CornerAngle | null;
  getOvertakingConfig: () => OvertakingConfig | null;
  getIsReadingWall: () => boolean;
  getTotalFrames: () => number;

  // Synchronous State Modifiers
  setSelectedStudy: (study: string) => void;
  setSelectedFile: (file: string) => void;
  setCameraMode: (mode: CameraMode) => void;
  setHeatmapMode: (mode: HeatmapMode) => void;
  setCurrentFrame: (frame: number | ((prev: number) => number)) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setUseRawRig: (useRawRig: boolean) => void;

  togglePlay: () => void;
  stepFrame: () => void;

  // Async API Actions
  fetchStudies: () => Promise<void>;
  fetchTrials: (study?: string) => Promise<void>;
  loadTrial: (filePath: string) => Promise<void>;
  runDTWSearch: () => Promise<void>;
  getIsDoorStudy: () => boolean;
  getPropType: () => 'person' | 'shelf' | 'stroller' | 'generic';
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  // Initial State
  studies: [],
  selectedStudy: 'All',
  trials: [],
  selectedFile: '',
  loading: false,
  searching: false,
  rawSkeleton: null,
  useRawRig: false,

  trajectories: { leader: [], follower: [], accompanier: [], obstacle: [] },
  telemetry: null,
  matches: [],
  matchTrajectories: [],

  isPlaying: false,
  currentFrame: 0,
  fps: 60,

  cameraMode: 'orbit',
  heatmapMode: 'none',

  // Derived Getters
  getCornerAngle: () => {
    const { selectedFile, selectedStudy } = get();
    const name = selectedFile.toLowerCase();
    const study = selectedStudy.toLowerCase();

    if (!study.includes('cornering') && !name.includes('cornering')) {
      return null;
    }
    if (name.includes('45')) return 45;
    if (name.includes('135')) return 135;
    return 90;
  },

  getOvertakingConfig: () => {
    const { selectedFile, selectedStudy } = get();
    const study = selectedStudy.toLowerCase();
    const name = selectedFile.toLowerCase();

    if (!study.includes('overtaking') && !name.includes('overtaking')) {
      return null;
    }

    let corridorWidth: OvertakingConfig['corridorWidth'] = 'medium';
    if (name.includes('wide')) corridorWidth = 'wide';
    else if (name.includes('thin')) corridorWidth = 'thin';

    const isNarrow = name.includes('narrow');
    const side: OvertakingConfig['side'] = name.includes('left') ? 'right' : 'left';

    return { corridorWidth, isNarrow, side };
  },

  getIsReadingWall: () => {
    const { selectedFile, selectedStudy } = get();
    const name = (selectedFile || '').toLowerCase();
    const study = (selectedStudy || '').toLowerCase();
    return study.includes('readingwall') || name.includes('readingwall');
  },

  // Update getTotalFrames to check every agent array
  getTotalFrames: () => {
    const { trajectories } = get();
    return Math.max(
      trajectories.leader?.length || 0,
      trajectories.follower?.length || 0,
      trajectories.accompanier?.length || 0,
      trajectories.obstacle?.length || 0
    );
  },

  setCurrentFrame: (frameOrUpdater) => {
    set((state) => {
      const nextFrame = typeof frameOrUpdater === 'function' ? frameOrUpdater(state.currentFrame) : frameOrUpdater;
      const total = Math.max(
        state.trajectories.leader?.length || 0,
        state.trajectories.follower?.length || 0,
        state.trajectories.accompanier?.length || 0,
        state.trajectories.obstacle?.length || 0
      );
      if (total === 0) return { currentFrame: 0 };
      return { currentFrame: Math.max(0, Math.min(nextFrame, total - 1)) };
    });
  },

  stepFrame: () => {
    const total = get().getTotalFrames();
    if (total === 0) return;
    const currentFrame = get().currentFrame;
    set({ currentFrame: currentFrame + 1 >= total ? 0 : currentFrame + 1 });
  },
  
  // State Mutators
  // Synchronous State Modifiers
  setSelectedStudy: (study) => {
    set({ selectedStudy: study });
    get().fetchTrials(study);
  },

  setSelectedFile: (file) => {
    // Only load if it's a new file or if trajectories are currently empty
    const current = get();
    if (file === current.selectedFile && current.trajectories.leader.length > 0) {
      return;
    }
    set({ selectedFile: file });
    get().loadTrial(file);
  },

  setCameraMode: (mode) => set({ cameraMode: mode }),
  setHeatmapMode: (mode) => set({ heatmapMode: mode }),
  setUseRawRig: (useRawRig) => set({ useRawRig }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
 
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  // Async Network Operations
  fetchStudies: async () => {
    try {
      const res = await fetch(`${API_BASE}/studies`);
      const data: string[] = await res.json();
      set({ studies: ['All', ...data], selectedStudy: 'All' });
    } catch (err) {
      console.error('Error fetching studies:', err);
    }
  },

  fetchTrials: async (study) => {
    const targetStudy = study ?? get().selectedStudy;
    const url = targetStudy && targetStudy !== 'All'
      ? `${API_BASE}/trials?study=${encodeURIComponent(targetStudy)}`
      : `${API_BASE}/trials`;

    try {
      const res = await fetch(url);
      const data: TrialMetadata[] = await res.json();
      set({ trials: data });

      if (data.length > 0) {
        get().setSelectedFile(data[0].filename);
      } else {
        set({
          selectedFile: '',
          trajectories: { leader: [], follower: [], accompanier: [], obstacle: [] },
          telemetry: null,
          currentFrame: 0,
        });
      }
    } catch (err) {
      console.error('Error fetching trials:', err);
    }
  },

  loadTrial: async (filePath) => {
    if (!filePath) return;

    set({ loading: true, matches: [], matchTrajectories: [] });

    try {
      const res = await fetch(`${API_BASE}/trajectory?file_path=${encodeURIComponent(filePath)}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data: TrajectoryResponse = await res.json();
      set({
        selectedFile: filePath,
        trajectories: {
          leader: data.leader || [],
          follower: data.follower || [],
          accompanier: data.accompanier || [],
          obstacle: data.obstacle || [],
          prop: data.prop_trajectory || [],
        },
        telemetry: data.telemetry,
        useRawRig: Boolean(data.raw_skeleton?.leader_markers),
        rawSkeleton: data.raw_skeleton || null,
        currentFrame: 0,
        loading: false,
      });
    } catch (err) {
      console.error('Error fetching trajectory:', err);
      set({ loading: false });
    }
  },

  runDTWSearch: async () => {
    const { selectedFile } = get();
    if (!selectedFile) return;
    set({ searching: true });

    try {
      const res = await fetch(`${API_BASE}/search?file_path=${encodeURIComponent(selectedFile)}&top_k=4`);
      const data: DTWMatch[] = await res.json();
      set({ matches: data });

      const overlayData: DTWOverlayData[] = await Promise.all(
        data.map(async (m) => {
          const trajRes = await fetch(`${API_BASE}/trajectory?file_path=${encodeURIComponent(m.filename)}`);
          const trajData: TrajectoryResponse = await trajRes.json();
          return {
            name: m.name,
            filename: m.filename,
            coords: trajData.follower,
            dtw_distance: m.dtw_distance,
          };
        })
      );
      set({ matchTrajectories: overlayData, searching: false });
    } catch (err) {
      console.error('DTW search failed:', err);
      set({ searching: false });
    }
  },

  // In usePlaybackStore.ts:
  getIsDoorStudy: () => {
    const { selectedFile, selectedStudy } = get();
    const name = (selectedFile || '').toLowerCase();
    const study = (selectedStudy || '').toLowerCase();
    return study.includes('door') || name.includes('door');
  },

  getPropType: (): 'person' | 'shelf' | 'stroller' | 'generic' => {
    const { selectedFile } = get();
    const name = (selectedFile || '').toLowerCase();
    if (name.includes('shelf')) return 'shelf';
    if (name.includes('stroller')) return 'stroller';
    if (name.includes('propPerson') || name.includes('readingwall')) return 'person';
    return 'generic';
  },
}));