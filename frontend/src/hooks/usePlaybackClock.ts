import { useEffect } from 'react';
import { usePlaybackStore } from '../store/usePlaybackStore.js';

export function usePlaybackClock() {
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const stepFrame = usePlaybackStore((s) => s.stepFrame);
  const totalFrames = usePlaybackStore((s) => s.trajectories.leader.length);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isPlaying && totalFrames > 0) {
      // 120 Hz MoCap capture sync
      interval = setInterval(() => {
        stepFrame();
      }, 1000 / 120);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, totalFrames, stepFrame]);
}