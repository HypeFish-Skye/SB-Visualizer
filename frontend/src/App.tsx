import { useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { BRAND } from './theme/brand.js';
import { usePlaybackStore } from './store/usePlaybackStore.js';
import { usePlaybackClock } from './hooks/usePlaybackClock.js';
import { Scene } from './components/Scene.js';
import { ControlPanel } from './components/hud/ControlPanel.js';
import { TelemetryHud } from './components/hud/TelemetryHud.js';
import { DiagnosticChart } from './components/hud/DiagnosticChart.js';

export default function App() {
  const fetchStudies = usePlaybackStore((s) => s.fetchStudies);
  const fetchTrials = usePlaybackStore((s) => s.fetchTrials);

  // Active frame progression clock
  usePlaybackClock();

  // Initial data bootstrap
  useEffect(() => {
    fetchStudies();
    fetchTrials();
  }, [fetchStudies, fetchTrials]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: BRAND.navy[700] }}>
      <ControlPanel />
      <TelemetryHud />
      <DiagnosticChart />

      <Canvas camera={{ position: [0, 8, 12], fov: 45 }}>
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}