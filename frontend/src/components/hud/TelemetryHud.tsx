import { BRAND } from '../../theme/brand.js';
import { usePlaybackStore } from '../../store/usePlaybackStore.js';

export function TelemetryHud() {
  const currentFrame = usePlaybackStore((s) => s.currentFrame);
  const telemetry = usePlaybackStore((s) => s.telemetry);

  const curFollSpeed = telemetry?.follower_speed?.[currentFrame]?.toFixed(2) ?? '0.00';
  const curLeadSpeed = telemetry?.leader_speed?.[currentFrame]?.toFixed(2) ?? '0.00';
  const curSep = telemetry?.separation?.[currentFrame]?.toFixed(2) ?? '0.00';
  const curCurv = telemetry?.follower_curvature?.[currentFrame]?.toFixed(2) ?? '0.00';

  return (
    <div
      style={{
        position: 'absolute',
        top: 24,
        right: 24,
        zIndex: 10,
        background: 'rgba(3, 12, 22, 0.88)',
        padding: '16px 20px',
        borderRadius: '10px',
        border: `1px solid ${BRAND.navy[500]}`,
        backdropFilter: 'blur(10px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        width: '220px',
        color: BRAND.beige[100],
      }}
    >
      <div style={{ fontSize: '0.7rem', color: BRAND.grey[400], textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>
        Telemetry HUD
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: '0.8rem', color: BRAND.grey[300] }}>Separation</span>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: BRAND.orange[400] }}>{curSep} m</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: '0.8rem', color: BRAND.grey[300] }}>Robot Speed</span>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: BRAND.cerulean[400] }}>{curFollSpeed} m/s</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: '0.8rem', color: BRAND.grey[300] }}>Leader Speed</span>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: BRAND.beige[100] }}>{curLeadSpeed} m/s</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.8rem', color: BRAND.grey[300] }}>Curvature (κ)</span>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: BRAND.grape[400] }}>{curCurv} m⁻¹</span>
      </div>
    </div>
  );
}