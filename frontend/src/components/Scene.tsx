import React, { useState, Suspense, useMemo } from 'react';
import { Line, Environment } from '@react-three/drei';
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
import { ViconSkeletonMesh } from './agents/ViconSkeletonMesh.js';
import { DoorMesh } from './agents/DoorMesh.js';
import { PhysicalPropMesh } from './agents/PhysicalPropMesh.js';

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
  const getIsDoorStudy = usePlaybackStore((s) => s.getIsDoorStudy);
  const getIsPropPerson = usePlaybackStore((s) => s.getIsPropPerson);
  const getFollowerType = usePlaybackStore((s) => s.getFollowerType);

  const cornerAngle = getCornerAngle();
  const overtakingConfig = getOvertakingConfig();
  const isReadingWall = getIsReadingWall();
  const isDoorStudy = getIsDoorStudy ? getIsDoorStudy() : false;
  const isPropPerson = getIsPropPerson ? getIsPropPerson() : false;
  const followerType = getFollowerType();

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

  // Prop Coordinates
  const propTrajectory = trajectories.prop || [];
  const hasProp = propTrajectory.length > 0 || !!(rawSkeleton?.prop_markers && Object.keys(rawSkeleton.prop_markers).length > 0);
  const rawPropPos = propTrajectory[currentFrame] || propTrajectory[0];
  const rawPropNext = propTrajectory[nextFrame] || rawPropPos;

  // Ground-plane coordinates for human PedestrianMesh (Y = 0.02)
  const propPedestrianPos: [number, number, number] | undefined = rawPropPos
    ? [rawPropPos[0], 0.02, rawPropPos[2]]
    : undefined;
  const propPedestrianNext: [number, number, number] | undefined = rawPropNext
    ? [rawPropNext[0], 0.02, rawPropNext[2]]
    : undefined;

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

      {/* Trajectories */}
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

      {/* Leader Representation */}
      {useRawRig && rawSkeleton?.leader_markers ? (
        <ViconSkeletonMesh markers={rawSkeleton.leader_markers} currentFrame={currentFrame} />
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

      {/* Accompanier */}
      {hasAccompanier && (
        <PedestrianMesh
          position={accompanierPos}
          nextPosition={accompanierNext}
          color={BRAND.grape[400]}
          visorColor={BRAND.grape[200]}
        />
      )}

      {/* Obstacles (ObstacleNavigation, Cornering) */}
      {hasObstacle && <ObstacleMesh position={obstaclePos} />}

      {/* Door Frame & Door Swing (Strictly Doors Study) */}
      {isDoorStudy && (
        <DoorMesh
          doorMarkers={rawSkeleton?.door_markers}
          doorSwingMarkers={rawSkeleton?.doorswing_markers}
          currentFrame={currentFrame}
        />
      )}

      {/* ======================================================== */}
      {/* FOLLOWER ENTITY (Robot vs. Physical Prop Cart/Wagon)     */}
      {/* ======================================================== */}
      {hasFollower && (
        <>
          {followerType === 'robot' ? (
            /* Autonomous Robot Follower (Gita) */
            <Suspense fallback={null}>
              <RobotFbxMesh position={followerPos} nextPosition={followerNext} />
            </Suspense>
          ) : (
            /* Follower Prop (Cart / Wagon / Shelf taking the place of the robot) */
            <PhysicalPropMesh
              trajectory={trajectories.follower}
              markers={rawSkeleton?.prop_markers}
              currentFrame={currentFrame}
            />
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* SECONDARY PROP ENTITY (Prop Person in ReadingWall)      */}
      {/* ======================================================== */}
      {hasProp && isPropPerson && (
        <group name="PropPerson">
          <PedestrianMesh
            position={propPedestrianPos}
            nextPosition={propPedestrianNext}
            color="#f59e0b" // Amber/Gold confederate
            visorColor="#fbbf24"
          />
          {rawSkeleton?.prop_markers &&
            Object.entries(rawSkeleton.prop_markers).map(([name, stream]) => {
              const pt = stream[Math.min(currentFrame, stream.length - 1)];
              if (!pt || (pt[0] === 0 && pt[1] === 0 && pt[2] === 0)) return null;
              return (
                <mesh key={`propperson-marker-${name}`} position={pt}>
                  <sphereGeometry args={[0.015, 16, 16]} />
                  <meshStandardMaterial color="#f59e0b" emissive="#d97706" emissiveIntensity={0.8} />
                </mesh>
              );
            })}
        </group>
      )}

      {/* Camera Rig */}
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