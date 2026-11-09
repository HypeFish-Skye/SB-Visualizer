import { useState, useMemo } from 'react';
import { BRAND } from '../../theme/brand.js';
import { usePlaybackStore } from '../../store/usePlaybackStore.js';
import { formatStudyName, parseTrialMetadata } from '../../utils/formatters.js';

export function ControlPanel() {
  const studies = usePlaybackStore((s) => s.studies);
  const selectedStudy = usePlaybackStore((s) => s.selectedStudy);
  const setSelectedStudy = usePlaybackStore((s) => s.setSelectedStudy);

  const trials = usePlaybackStore((s) => s.trials);
  const selectedFile = usePlaybackStore((s) => s.selectedFile);
  const setSelectedFile = usePlaybackStore((s) => s.setSelectedFile);

  const cameraMode = usePlaybackStore((s) => s.cameraMode);
  const setCameraMode = usePlaybackStore((s) => s.setCameraMode);

  const heatmapMode = usePlaybackStore((s) => s.heatmapMode);
  const setHeatmapMode = usePlaybackStore((s) => s.setHeatmapMode);

  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const togglePlay = usePlaybackStore((s) => s.togglePlay);
  const currentFrame = usePlaybackStore((s) => s.currentFrame);

  const loading = usePlaybackStore((s) => s.loading);
  const searching = usePlaybackStore((s) => s.searching);
  const matches = usePlaybackStore((s) => s.matches);
  const runDTWSearch = usePlaybackStore((s) => s.runDTWSearch);

  const hasAccompanier = usePlaybackStore((s) => s.trajectories.accompanier.length > 0);
  const hasObstacle = usePlaybackStore((s) => s.trajectories.obstacle.length > 0);
  const hasMatches = usePlaybackStore((s) => s.matchTrajectories.length > 0);

  const isReadingWall = usePlaybackStore((s) => s.getIsReadingWall());
  const useRawRig = usePlaybackStore((s) => s.useRawRig);
  const setUseRawRig = usePlaybackStore((s) => s.setUseRawRig);
  const hasRawSkeleton = !!usePlaybackStore((s) => s.rawSkeleton?.leader_markers);

  // Local state for instant trial filtering
  const [trialFilter, setTrialFilter] = useState('');

  // Parse all trials for instant search & display
  const parsedTrials = useMemo(() => {
    return trials.map((t) => ({
      ...t,
      info: parseTrialMetadata(t.filename),
    }));
  }, [trials]);

  // Filtered trials based on search input
  const filteredTrials = useMemo(() => {
    if (!trialFilter.trim()) return parsedTrials;
    const q = trialFilter.toLowerCase();
    return parsedTrials.filter(
      (t) =>
        t.info.fullLabel.toLowerCase().includes(q) ||
        t.filename.toLowerCase().includes(q)
    );
  }, [parsedTrials, trialFilter]);

  // Group trials by participant subject
  const groupedTrials = useMemo(() => {
    const groups: Record<string, typeof filteredTrials> = {};
    for (const t of filteredTrials) {
      const key = t.info.subject || 'Other';
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }
    return groups;
  }, [filteredTrials]);

  // Active trial parsed details
  const activeTrialInfo = useMemo(() => {
    if (!selectedFile) return null;
    return parseTrialMetadata(selectedFile);
  }, [selectedFile]);

  const cameraButtons = [
    { id: 'orbit', label: 'Orbit' },
    { id: 'chase', label: 'Chase' },
    { id: 'duo', label: 'Duo' },
    { id: 'overhead', label: 'Top' },
    { id: 'follower_pov', label: 'Follower POV' },
  ] as const;

  const heatmapButtons = [
    { id: 'none', label: 'Solid' },
    { id: 'speed', label: 'Velocity' },
    { id: 'curvature', label: 'Curvature' },
  ] as const;

  return (
    <div
      style={{
        position: 'absolute',
        top: 24,
        left: 24,
        zIndex: 10,
        background: 'rgba(3, 12, 22, 0.90)',
        padding: '20px',
        borderRadius: '10px',
        color: BRAND.beige[100],
        width: '325px',
        border: `1px solid ${BRAND.navy[500]}`,
        backdropFilter: 'blur(10px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        maxHeight: 'calc(100vh - 180px)',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '1.15rem', color: BRAND.cerulean[400], fontWeight: 700, letterSpacing: '0.5px' }}>
          Kinematic Explorer
        </h2>
        {(loading || searching) && (
          <span style={{ fontSize: '0.72rem', color: BRAND.cerulean[300], fontWeight: 600 }}>Processing...</span>
        )}
      </div>

      {/* 1. Study / Scenario Selector with Spaced Names */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <label style={{ fontSize: '0.72rem', color: BRAND.grey[300], textTransform: 'uppercase', letterSpacing: '1px' }}>
            Study / Scenario
          </label>
          <span style={{ fontSize: '0.68rem', color: BRAND.cerulean[300] }}>
            {studies.length} available
          </span>
        </div>
        <select
          value={selectedStudy}
          onChange={(e) => {
            setSelectedStudy(e.target.value);
            setTrialFilter(''); // Reset trial filter on study change
          }}
          style={{
            width: '100%',
            padding: '8px 10px',
            background: BRAND.navy[600],
            color: BRAND.cerulean[300],
            border: `1px solid ${BRAND.navy[400]}`,
            borderRadius: '6px',
            marginTop: 5,
            fontSize: '0.82rem',
            fontWeight: 600,
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          {studies.map((s, idx) => (
            <option key={idx} value={s}>
              {formatStudyName(s)}
            </option>
          ))}
        </select>
      </div>

      {/* 2. Dataset Trial Selector with Optgroups & Search */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
          <label style={{ fontSize: '0.72rem', color: BRAND.grey[300], textTransform: 'uppercase', letterSpacing: '1px' }}>
            Dataset Trial
          </label>
          <span style={{ fontSize: '0.68rem', color: BRAND.grey[400] }}>
            {filteredTrials.length} of {trials.length}
          </span>
        </div>

        {/* Quick Filter Search Bar */}
        <input
          type="text"
          value={trialFilter}
          onChange={(e) => setTrialFilter(e.target.value)}
          placeholder="🔍 Filter (e.g. Ben, 90, Cart, Left)..."
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '6px 10px',
            background: 'rgba(7, 26, 46, 0.7)',
            color: BRAND.beige[100],
            border: `1px solid ${BRAND.navy[400]}`,
            borderRadius: '5px 5px 0 0',
            fontSize: '0.75rem',
            outline: 'none',
          }}
        />

        {/* Grouped Select Dropdown */}
        <select
          value={selectedFile}
          onChange={(e) => setSelectedFile(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 10px',
            background: BRAND.navy[600],
            color: BRAND.beige[100],
            border: `1px solid ${BRAND.navy[400]}`,
            borderTop: 'none',
            borderRadius: '0 0 6px 6px',
            fontSize: '0.8rem',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          {filteredTrials.length === 0 ? (
            <option value="">No matching trials</option>
          ) : (
            Object.entries(groupedTrials).map(([subject, subTrials]) => (
              <optgroup key={subject} label={`${subject} (${subTrials.length})`}>
                {subTrials.map((t) => (
                  <option key={t.filename} value={t.filename}>
                    {t.info.description}
                  </option>
                ))}
              </optgroup>
            ))
          )}
        </select>

        {/* Active Trial Parameter Badges */}
        {activeTrialInfo && (
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <span
              style={{
                fontSize: '0.68rem',
                padding: '2px 7px',
                borderRadius: '4px',
                background: BRAND.navy[500],
                color: BRAND.cerulean[200],
                fontWeight: 600,
              }}
            >
              👤 {activeTrialInfo.subject}
            </span>
            {activeTrialInfo.tags.map((tag, i) => (
              <span
                key={i}
                style={{
                  fontSize: '0.68rem',
                  padding: '2px 7px',
                  borderRadius: '4px',
                  background: 'rgba(255,255,255,0.08)',
                  color: BRAND.grey[200],
                }}
              >
                {tag}
              </span>
            ))}
            {activeTrialInfo.run && (
              <span
                style={{
                  fontSize: '0.68rem',
                  padding: '2px 7px',
                  borderRadius: '4px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: '#fbbf24',
                  fontWeight: 600,
                }}
              >
                {activeTrialInfo.run}
              </span>
            )}
          </div>
        )}
      </div>

      {/* MoCap Skeletal Rig Selector Card (Available for Reading Wall Trials) */}
      {hasRawSkeleton && (
        <div style={{ marginBottom: 14, background: 'rgba(56, 189, 248, 0.08)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: BRAND.cerulean[300], fontWeight: 700, textTransform: 'uppercase' }}>
              Human Representation
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
            <button
              onClick={() => setUseRawRig(false)}
              style={{
                background: !useRawRig ? BRAND.cerulean[500] : BRAND.navy[600],
                color: !useRawRig ? BRAND.navy[700] : BRAND.grey[200],
                border: 'none',
                padding: '5px 0',
                borderRadius: '4px',
                fontSize: '0.7rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              FBX Character
            </button>
            <button
              onClick={() => setUseRawRig(true)}
              style={{
                background: useRawRig ? BRAND.cerulean[500] : BRAND.navy[600],
                color: useRawRig ? BRAND.navy[700] : BRAND.grey[200],
                border: 'none',
                padding: '5px 0',
                borderRadius: '4px',
                fontSize: '0.7rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Vicon MoCap Rig
            </button>
          </div>
        </div>
      )}

      {/* Camera Rig Toggle */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: '0.72rem', color: BRAND.grey[300], textTransform: 'uppercase', letterSpacing: '1px' }}>
          Camera Rig
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 4 }}>
          {cameraButtons.map((cam) => (
            <button
              key={cam.id}
              onClick={() => setCameraMode(cam.id)}
              style={{
                background: cameraMode === cam.id ? BRAND.cerulean[500] : BRAND.navy[600],
                color: cameraMode === cam.id ? BRAND.navy[700] : BRAND.grey[200],
                border: `1px solid ${cameraMode === cam.id ? BRAND.cerulean[400] : BRAND.navy[500]}`,
                padding: '6px 0',
                borderRadius: '5px',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {cam.label}
            </button>
          ))}
        </div>
      </div>

      {/* Path Heatmap Overlay */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: '0.72rem', color: BRAND.grey[300], textTransform: 'uppercase', letterSpacing: '1px' }}>
          Path Heatmap
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 4 }}>
          {heatmapButtons.map((m) => (
            <button
              key={m.id}
              onClick={() => setHeatmapMode(m.id)}
              style={{
                background: heatmapMode === m.id ? BRAND.cerulean[500] : BRAND.navy[600],
                color: heatmapMode === m.id ? BRAND.navy[700] : BRAND.grey[200],
                border: `1px solid ${heatmapMode === m.id ? BRAND.cerulean[400] : BRAND.navy[500]}`,
                padding: '6px 0',
                borderRadius: '5px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Playback Controls */}
      <div style={{ borderTop: `1px solid ${BRAND.navy[500]}`, paddingTop: 12, marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={togglePlay}
            style={{
              background: isPlaying ? BRAND.orange[500] : BRAND.cerulean[500],
              border: 'none',
              color: isPlaying ? '#ffffff' : BRAND.navy[700],
              fontWeight: 700,
              padding: '6px 16px',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '0.8rem',
            }}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <span style={{ fontSize: '0.75rem', color: BRAND.grey[300] }}>
            Time {(currentFrame / 60).toFixed(2)}s
          </span>
        </div>
      </div>

      {/* DTW Multi-Run Search */}
      <div style={{ borderTop: `1px solid ${BRAND.navy[500]}`, paddingTop: 12 }}>
        <button
          onClick={runDTWSearch}
          disabled={searching}
          style={{
            width: '100%',
            background: 'transparent',
            border: `1px solid ${BRAND.cerulean[400]}`,
            color: BRAND.cerulean[300],
            fontWeight: 600,
            padding: '8px',
            borderRadius: '5px',
            cursor: searching ? 'not-allowed' : 'pointer',
            fontSize: '0.8rem',
          }}
        >
          {searching ? 'Querying C++ DTW...' : '⚡ Find Similar Trajectories'}
        </button>

        {matches.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <span style={{ fontSize: '0.7rem', color: BRAND.grey[400], textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Multi-Run Matches ({matches.length})
            </span>
            {matches.map((m, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedFile(m.filename)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 8px',
                  marginTop: 5,
                  background: BRAND.navy[600],
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  border: `1px solid ${BRAND.navy[500]}`,
                }}
              >
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '170px' }}>
                  {parseTrialMetadata(m.filename).fullLabel}
                </span>
                <span style={{ color: BRAND.orange[400], fontWeight: 700 }}>
                  {m.dtw_distance.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ fontSize: '0.75rem', color: BRAND.grey[300], borderTop: `1px solid ${BRAND.navy[500]}`, paddingTop: 12, marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ width: 14, height: 3, background: BRAND.beige[100], marginRight: 10, borderRadius: 2 }} />
          Leader (Human)
        </div>
        {hasAccompanier && (
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ width: 14, height: 3, background: BRAND.grape[400], marginRight: 10, borderRadius: 2 }} />
            Accompanier
          </div>
        )}
        {hasObstacle && (
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ width: 14, height: 3, background: BRAND.orange[500], marginRight: 10, borderRadius: 2 }} />
            Dynamic Obstacle
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: hasMatches ? 6 : 0 }}>
          <span style={{ width: 14, height: 3, background: BRAND.cerulean[400], borderBottom: `2px dashed ${BRAND.cerulean[400]}`, marginRight: 10 }} />
          Follower (Robot)
        </div>
        {hasMatches && (
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 6 }}>
            <span style={{ width: 14, height: 2, background: BRAND.orange[400], opacity: 0.6, marginRight: 10 }} />
            Matched Overlays
          </div>
        )}
      </div>
    </div>
  );
}