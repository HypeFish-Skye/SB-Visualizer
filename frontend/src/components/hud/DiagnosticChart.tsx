import { useState, useMemo, useRef, PointerEvent } from 'react';
import { BRAND } from '../../theme/brand.js';
import { usePlaybackStore } from '../../store/usePlaybackStore.js';

export function DiagnosticChart() {
  const [collapsed, setCollapsed] = useState(false);
  const svgRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const telemetry = usePlaybackStore((s) => s.telemetry);
  const currentFrame = usePlaybackStore((s) => s.currentFrame);
  const totalFrames = usePlaybackStore((s) => s.getTotalFrames());
  const setCurrentFrame = usePlaybackStore((s) => s.setCurrentFrame);
  const setIsPlaying = usePlaybackStore((s) => s.setIsPlaying);

  const handleSeek = (e: PointerEvent<HTMLDivElement>) => {
    if (!svgRef.current || totalFrames <= 0) return;
    setIsPlaying(false);
    const rect = svgRef.current.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const frame = Math.round((clickX / rect.width) * (totalFrames - 1));
    setCurrentFrame(frame);
  };

  const createPolyline = (dataArr?: number[], maxVal: number = 1, height: number = 55): string => {
    if (!dataArr || dataArr.length === 0) return '';
    const len = dataArr.length;
    return dataArr
      .map((val, idx) => {
        const x = (idx / (len - 1)) * 100;
        const clamped = Math.max(0, Math.min(val, maxVal));
        const y = height - (clamped / maxVal) * (height - 8) - 4;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  };

  const speedPointsLeader = useMemo(() => createPolyline(telemetry?.leader_speed, 2.5, 55), [telemetry]);
  const speedPointsFollower = useMemo(() => createPolyline(telemetry?.follower_speed, 2.5, 55), [telemetry]);
  const sepPoints = useMemo(() => createPolyline(telemetry?.separation, 3.5, 55), [telemetry]);
  const curvPoints = useMemo(() => createPolyline(telemetry?.follower_curvature, 2.0, 55), [telemetry]);
  
  // New Commitment (0.0 to 1.0) and Hand Lift (0.0 to 0.5m) series
  const commitPoints = useMemo(() => createPolyline(telemetry?.commitment, 1.0, 55), [telemetry]);
  const handLiftPoints = useMemo(() => createPolyline(telemetry?.hand_lift, 0.5, 55), [telemetry]);

  const cursorX = totalFrames > 1 ? ((currentFrame / (totalFrames - 1)) * 100).toFixed(2) : '0';

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: 345,
        right: 24,
        zIndex: 10,
        background: 'rgba(3, 12, 22, 0.90)',
        padding: collapsed ? '8px 16px' : '12px 18px',
        borderRadius: '10px',
        border: `1px solid ${BRAND.navy[500]}`,
        backdropFilter: 'blur(10px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        userSelect: 'none',
        transition: 'padding 0.2s ease, all 0.2s ease',
      }}
      onPointerUp={() => (isDragging.current = false)}
      onPointerLeave={() => (isDragging.current = false)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: collapsed ? 0 : 8 }}>
        <div style={{ display: 'flex', gap: 14, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.8px', flexWrap: 'wrap' }}>
          <span style={{ color: BRAND.grey[400], fontWeight: 700 }}>Telemetry</span>
          {!collapsed && (
            <>
              <span style={{ color: BRAND.beige[200] }}>— Leader Speed</span>
              <span style={{ color: BRAND.cerulean[400] }}>— Robot Speed</span>
              <span style={{ color: BRAND.orange[400] }}>— Separation</span>
              <span style={{ color: BRAND.grape[400] }}>— Curvature</span>
              {telemetry?.commitment && <span style={{ color: '#2dd4bf', fontWeight: 600 }}>— Commitment</span>}
              {telemetry?.hand_lift && <span style={{ color: '#fbbf24', fontWeight: 600 }}>— Hand Lift</span>}
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: '0.72rem', color: BRAND.grey[300], fontFamily: 'monospace' }}>
            {(currentFrame / 60).toFixed(2)}s / {((totalFrames || 0) / 60).toFixed(2)}s
          </span>
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              background: BRAND.navy[600],
              border: `1px solid ${BRAND.navy[400]}`,
              color: BRAND.cerulean[300],
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '0.68rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {collapsed ? '▴ Expand' : '▾ Collapse'}
          </button>
        </div>
      </div>

      <div
        ref={svgRef}
        onPointerDown={(e) => {
          isDragging.current = true;
          handleSeek(e);
        }}
        onPointerMove={(e) => {
          if (isDragging.current) handleSeek(e);
        }}
        style={{
          width: '100%',
          height: collapsed ? '12px' : '65px',
          position: 'relative',
          cursor: 'col-resize',
          marginTop: collapsed ? 6 : 0,
          background: collapsed ? BRAND.navy[600] : 'transparent',
          borderRadius: collapsed ? '3px' : '0',
        }}
      >
        <svg viewBox="0 0 100 60" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          {!collapsed && (
            <>
              <line x1="0" y1="15" x2="100" y2="15" stroke={BRAND.navy[600]} strokeWidth="0.5" strokeDasharray="2,2" />
              <line x1="0" y1="35" x2="100" y2="35" stroke={BRAND.navy[600]} strokeWidth="0.5" strokeDasharray="2,2" />
              {sepPoints && <polyline fill="none" stroke={BRAND.orange[400]} strokeWidth="1.3" opacity="0.85" points={sepPoints} />}
              {curvPoints && <polyline fill="none" stroke={BRAND.grape[400]} strokeWidth="1.3" opacity="0.9" points={curvPoints} />}
              {speedPointsLeader && <polyline fill="none" stroke={BRAND.beige[200]} strokeWidth="1.2" opacity="0.75" points={speedPointsLeader} />}
              {speedPointsFollower && <polyline fill="none" stroke={BRAND.cerulean[400]} strokeWidth="1.6" points={speedPointsFollower} />}
              {commitPoints && <polyline fill="none" stroke="#2dd4bf" strokeWidth="1.5" opacity="0.9" points={commitPoints} />}
              {handLiftPoints && <polyline fill="none" stroke="#fbbf24" strokeWidth="1.5" opacity="0.9" points={handLiftPoints} />}
            </>
          )}
          <line
            x1={cursorX}
            y1={collapsed ? '0' : '-6'}
            x2={cursorX}
            y2={collapsed ? '60' : '66'}
            stroke={BRAND.orange[500]}
            strokeWidth={collapsed ? '2.5' : '1.4'}
          />
        </svg>
      </div>
    </div>
  );
}