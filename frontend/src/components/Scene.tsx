import React, {useState, Suspense, useMemo } from 'react';
import { Line, Environment, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { BRAND } from '../theme/brand.js';
import { getHeatmapColor } from '../utils/mocapMath.js';
import { usePlaybackStore } from '../store/usePlaybackStore.js';
import { LabArena } from './scene/LabArena.js';
import { PedestrianMesh } from './agents/PedestrianMesh.js';
import { HumanFbxMesh } from './agents/HumanFbxMesh.js';
import { ObstacleMesh } from './agents/ObstacleMesh.js';
import { RobotFbxMesh } from './agents/RobotFbxMesh.js';
import { GhostFollower } from './agents/GhostFollower.js';
import { CameraRig } from './camera/CameraRig.js';
import { PropMesh } from './agents/PropMesh.js';
import { ViconSkeletonMesh } from './agents/ViconSkeletonMesh.js';
import { DoorMesh } from './agents/DoorMesh.js';

export function Scene() {
  const currentFrame = usePlaybackStore((s) => s.currentFrame);
  const trajectories = usePlaybackStore((s) => s.trajectories);
  const matchTrajectories = usePlaybackStore((s) => s.matchTrajectories);
  const cameraMode = usePlaybackStore((s) => s.cameraMode);
  const heatmapMode = usePlaybackStore((s) => s.heatmapMode);
  const telemetry = usePlaybackStore((s) => s.telemetry);
  const useRawRig = usePlaybackStore((s) => s.useRawRig);
  const rawSkeleton = usePlaybackStore((s) => s.rawSkeleton);
  const setSelectedFile = usePlaybackStore((s) => s.setSelectedFile);
  const getCornerAngle = usePlaybackStore((s) => s.getCornerAngle);
  const getOvertakingConfig = usePlaybackStore((s) => s.getOvertakingConfig);
  const getIsReadingWall = usePlaybackStore((s) => s.getIsReadingWall);

  const cornerAngle = getCornerAngle();
  const overtakingConfig = getOvertakingConfig();
  const isReadingWall = usePlaybackStore((s) => s.getIsReadingWall());
  const isDoorStudy = usePlaybackStore((s) => s.getIsDoorStudy());
  const propType = usePlaybackStore((s) => s.getPropType());

  const nextFrame = currentFrame + 1;
  const leaderPos = trajectories.leader[currentFrame] || trajectories.leader[0];
  const leaderNext = trajectories.leader[nextFrame] || leaderPos;
  const leaderSpeed = telemetry?.leader_speed?.[currentFrame] ?? 0;

  const hasFollower = (trajectories.follower?.length ?? 0) > 0;
  const followerPos = hasFollower ? (trajectories.follower[currentFrame] || trajectories.follower[0]) : undefined;
  const followerNext = hasFollower ? (trajectories.follower[nextFrame] || followerPos) : undefined;

  const hasAccompanier = (trajectories.accompanier?.length ?? 0) > 0;
  const accompanierPos = hasAccompanier ? (trajectories.accompanier[currentFrame] || trajectories.accompanier[0]) : undefined;
  const accompanierNext = hasAccompanier ? (trajectories.accompanier[nextFrame] || accompanierPos) : undefined;

  const hasObstacle = (trajectories.obstacle?.length ?? 0) > 0;
  const obstaclePos = hasObstacle ? (trajectories.obstacle[currentFrame] || trajectories.obstacle[0]) : undefined;

// Only consider props valid if this study actually has a prop or if prop markers exist
  const hasProp = Boolean(
    (isReadingWall || isDoorStudy) &&
    ((trajectories.prop?.length ?? 0) > 0 || (rawSkeleton?.prop_markers && Object.keys(rawSkeleton.prop_markers).length > 0))
  );

  const followerColors = useMemo(() => {
    if (heatmapMode === 'none' || !telemetry || trajectories.follower.length === 0) return null;
    const vals = heatmapMode === 'speed' ? telemetry.follower_speed : telemetry.follower_curvature;
    const minVal = 0.0;
    const maxVal = heatmapMode === 'speed' ? 2.2 : 1.5;
    return vals.map((v) => getHeatmapColor(v, minVal, maxVal));
  }, [heatmapMode, telemetry, trajectories.follower]);

  return (
    <>
      <color attach="background" args={[BRAND.navy[700]]} />
      <fog attach="fog" args={[BRAND.navy[700], 14, 42]} />

      <Environment preset="city" environmentIntensity={0.55} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[10, 16, 8]} intensity={1.2} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-10, 12, -10]} intensity={0.35} color={BRAND.cerulean[200]} />

      {/* Lab Environment */}
      <LabArena
        size={22}
        cornerAngle={cornerAngle}
        overtakingConfig={overtakingConfig}
        isReadingWall={isReadingWall}
      />

      {/* Trajectory Lines */}
      {trajectories.leader.length >= 2 && (
        <Line points={trajectories.leader} color={BRAND.beige[100]} lineWidth={3.5} />
      )}
      {hasAccompanier && trajectories.accompanier.length >= 2 && (
        <Line points={trajectories.accompanier} color={BRAND.grape[400]} lineWidth={3.0} />
      )}
      {hasObstacle && trajectories.obstacle.length >= 2 && (
        <Line points={trajectories.obstacle} color={BRAND.orange[400]} lineWidth={2.0} dashed dashSize={0.25} gapSize={0.2} opacity={0.65} transparent />
      )}
      {trajectories.follower.length >= 2 && (
        <Line
          points={trajectories.follower}
          color={followerColors ? undefined : BRAND.cerulean[400]}
          vertexColors={followerColors || undefined}
          lineWidth={3.5}
          dashed={!followerColors}
          dashSize={0.3}
          gapSize={0.2}
        />
      )}

      {/* Multi-Run DTW Ghosts */}
      {matchTrajectories.map((m, idx) => {
        const ghostIdx = Math.min(currentFrame, m.coords.length - 1);
        const ghostPos = m.coords[ghostIdx];
        return (
          <group key={idx}>
            <Line points={m.coords} color={BRAND.orange[400]} lineWidth={1.5} opacity={0.35} transparent />
            <GhostFollower position={ghostPos} label={m.name} onClick={() => setSelectedFile(m.filename)} />
          </group>
        );
      })}

      {/* Human Leader Representation */}
      {useRawRig && rawSkeleton?.leader_markers ? (
        <ViconSkeletonMesh
          markers={rawSkeleton.leader_markers}
          currentFrame={currentFrame}
        />
      ) : (
        <Suspense fallback={<PedestrianMesh position={leaderPos} nextPosition={leaderNext} />}>
          <HumanFbxMesh
            position={leaderPos}
            nextPosition={leaderNext}
            trajectory={trajectories.leader}
            currentFrame={currentFrame}
            speed={leaderSpeed}
          />
        </Suspense>
      )}

      {/* Accompanier Agent */}
      {hasAccompanier && (
        <PedestrianMesh
          position={accompanierPos}
          nextPosition={accompanierNext}
          color={BRAND.grape[400]}
          visorColor={BRAND.grape[200]}
        />
      )}

      {/* Obstacles (Strictly for ObstacleNavigation & Cornering) */}
      {hasObstacle && <ObstacleMesh position={obstaclePos} />}

     {/* Door Frame & Swing Leaf (Strictly for Door Studies) */}
      {isDoorStudy && (
        <DoorMesh
          doorMarkers={rawSkeleton?.door_markers}
          doorSwingMarkers={rawSkeleton?.doorswing_markers}
          currentFrame={currentFrame}
        />
      )}

      {/* Generalized Physical Prop / Accompaniment */}
      {hasProp && (
        <PropMesh
          propTrajectory={trajectories.prop || []}
          propMarkers={rawSkeleton?.prop_markers}
          propType={propType}
          currentFrame={currentFrame}
        />
      )}``

      {/* Static Door Frame Perimeter */}
      {rawSkeleton?.door_markers && (
        <group name="StaticDoorFrame">
          {Object.entries(rawSkeleton.door_markers).map(([name, pt]) => (
            <mesh key={`door-${name}`} position={pt as [number, number, number]}>
              <sphereGeometry args={[0.022, 16, 16]} />
              <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={0.7} />
            </mesh>
          ))}

          {/* Door Frame Connecting Outline (Left Jamb -> Header -> Right Jamb) */}
          {rawSkeleton.door_markers['M_4'] && rawSkeleton.door_markers['M_1'] && (
            <line>
              <bufferGeometry
                attach="geometry"
                onUpdate={(geom) => {
                  const m1 = rawSkeleton.door_markers!['M_1'];
                  const m2 = rawSkeleton.door_markers!['M_2'];
                  const m3 = rawSkeleton.door_markers!['M_3'];
                  const m4 = rawSkeleton.door_markers!['M_4'];
                  const m5 = rawSkeleton.door_markers!['M_5'];
                  geom.setFromPoints([
                    new THREE.Vector3(m4[0], 0.02, m4[2]),
                    new THREE.Vector3(m4[0], m4[1], m4[2]),
                    new THREE.Vector3(m3[0], m3[1], m3[2]),
                    new THREE.Vector3(m1[0], m1[1], m1[2]),
                    new THREE.Vector3(m2[0], m2[1], m2[2]),
                    new THREE.Vector3(m5[0], m5[1], m5[2]),
                    new THREE.Vector3(m5[0], 0.02, m5[2]),
                  ]);
                }}
              />
              <lineBasicMaterial color="#0284c7" linewidth={2} opacity={0.75} transparent />
            </line>
          )}
        </group>
      )}

      {/* Dynamic Door Swing Leaf */}
      {rawSkeleton?.doorswing_markers && (
        <group name="DoorSwing">
          {Object.entries(rawSkeleton.doorswing_markers).map(([name, stream]) => {
            const pt = stream[Math.min(currentFrame, stream.length - 1)];
            if (!pt || (pt[0] === 0 && pt[1] === 0 && pt[2] === 0)) return null;
            return (
              <mesh key={`doorswing-${name}`} position={pt}>
                <sphereGeometry args={[0.02, 16, 16]} />
                <meshStandardMaterial color="#10b981" emissive="#059669" emissiveIntensity={0.8} />
              </mesh>
            );
          })}
        </group>
      )}

      {/* Robot Agent */}
      <Suspense fallback={null}>
        <RobotFbxMesh position={followerPos} nextPosition={followerNext} />
      </Suspense>

      {/* Camera Rig (Leader fallback when no follower) */}
      <CameraRig
        mode={cameraMode}
        targetPos={followerPos}
        nextPos={followerNext}
        leaderPos={leaderPos}
        leaderNext={leaderNext}
      />
    </>
  );
}