import React, { useState, Suspense, useMemo } from 'react';
import { Line } from '@react-three/drei';
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
  
  const selectedStudy = usePlaybackStore((s) => s.selectedStudy);
  const selectedFile = usePlaybackStore((s) => s.selectedFile);
  const setSelectedFile = usePlaybackStore((s) => s.setSelectedFile);
  
  const getCornerAngle = usePlaybackStore((s) => s.getCornerAngle);
  const getOvertakingConfig = usePlaybackStore((s) => s.getOvertakingConfig);
  const getIsReadingWall = usePlaybackStore((s) => s.getIsReadingWall);
  const getIsDoorStudy = usePlaybackStore((s) => s.getIsDoorStudy);
  const getFollowerType = usePlaybackStore((s) => s.getFollowerType);
  const getIsPropPerson = usePlaybackStore((s) => s.getIsPropPerson);

  const cornerAngle = getCornerAngle();
  const overtakingConfig = getOvertakingConfig();
  const isReadingWall = getIsReadingWall();
  const isDoorStudy = getIsDoorStudy ? getIsDoorStudy() : false;
  const followerType = getFollowerType ? getFollowerType() : 'robot';
  const isPropPerson = getIsPropPerson ? getIsPropPerson() : false;
  
  const isObstacleNav = selectedStudy.toLowerCase().includes('obstacle') || selectedFile.toLowerCase().includes('obstacle');

  const nextFrame = currentFrame + 1;
  const leaderPos = trajectories.leader[currentFrame] || trajectories.leader[0];
  const leaderNext = trajectories.leader[nextFrame] || leaderPos;
  const leaderSpeed = telemetry?.leader_speed?.[currentFrame] ?? 0;

  // Ensure groups render if either the calculated trajectory exists OR raw optical markers are present
  const hasLeader = (trajectories.leader?.length ?? 0) > 0 || !!(rawSkeleton?.leader_markers && Object.keys(rawSkeleton.leader_markers).length > 0);
  const hasFollower = (trajectories.follower?.length ?? 0) > 0 || !!(rawSkeleton?.follower_markers && Object.keys(rawSkeleton.follower_markers).length > 0);
  const hasObstacle = (trajectories.obstacle?.length ?? 0) > 0 || !!(rawSkeleton?.obstacle_markers && Object.keys(rawSkeleton.obstacle_markers).length > 0);
  const hasAccompanier = (trajectories.accompanier?.length ?? 0) > 0;

  const followerPos = hasFollower ? (trajectories.follower[currentFrame] || trajectories.follower[0]) : undefined;
  const followerNext = hasFollower ? (trajectories.follower[nextFrame] || followerPos) : undefined;
  const followerSpeed = telemetry?.follower_speed?.[currentFrame] ?? 0;

  const accompanierPos = hasAccompanier ? (trajectories.accompanier[currentFrame] || trajectories.accompanier[0]) : undefined;
  const accompanierNext = hasAccompanier ? (trajectories.accompanier[nextFrame] || accompanierPos) : undefined;

  const obstaclePos = hasObstacle ? (trajectories.obstacle[currentFrame] || trajectories.obstacle[0]) : undefined;

  const propTrajectory = trajectories.prop || [];
  const rawPropPos = propTrajectory[currentFrame] || propTrajectory[0];
  const rawPropNext = propTrajectory[nextFrame] || rawPropPos;

  const hasPropData = propTrajectory.length > 0 || !!(rawSkeleton?.prop_markers && Object.keys(rawSkeleton.prop_markers).length > 0);

  const propPedestrianPos: [number, number, number] | undefined = rawPropPos ? [rawPropPos[0], 0.02, rawPropPos[2]] : undefined;
  const propPedestrianNext: [number, number, number] | undefined = rawPropNext ? [rawPropNext[0], 0.02, rawPropNext[2]] : undefined;

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
      
      {/* Soft, non-reflective lighting to remove floor glare */}
      <ambientLight intensity={0.75} />
      <directionalLight position={[10, 16, 8]} intensity={0.6} castShadow shadow-mapSize={[1024, 1024]} />

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
      {hasPropData && isPropPerson && propTrajectory.length >= 2 && (
        <Line points={propTrajectory} color="#f59e0b" lineWidth={2.0} dashed dashSize={0.3} gapSize={0.2} opacity={0.7} transparent />
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

      {/* DTW Ghosts */}
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

      {/* Leader */}
      {hasLeader && (
        <group name="LeaderEntity">
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
        </group>
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

      {/* Follower Slot */}
      {hasFollower && (
        <group name="FollowerEntity">
          {followerType === 'robot' && (
            <Suspense fallback={null}>
              <RobotFbxMesh position={followerPos} nextPosition={followerNext} />
            </Suspense>
          )}
          {followerType === 'physical_prop' && (
            <PhysicalPropMesh
              position={followerPos}
              nextPosition={followerNext}
              trajectory={trajectories.follower}
              markers={rawSkeleton?.follower_markers} 
              currentFrame={currentFrame}
            />
          )}
          {followerType === 'human' && (
             useRawRig && rawSkeleton?.follower_markers ? (
               <ViconSkeletonMesh markers={rawSkeleton.follower_markers} currentFrame={currentFrame} />
             ) : (
               <Suspense fallback={<PedestrianMesh position={followerPos} nextPosition={followerNext} />}>
                 <HumanFbxMesh
                   position={followerPos}
                   nextPosition={followerNext}
                   trajectory={trajectories.follower}
                   currentFrame={currentFrame}
                   speed={followerSpeed}
                 />
               </Suspense>
             )
          )}
        </group>
      )}

      {/* Obstacle Slot */}
      {hasObstacle && (
        <group name="ObstacleEntity">
          {isObstacleNav ? (
            <>
              {/* Lower the opacity if raw rig is toggled so the floating dot markers show through the body */}
              <PedestrianMesh 
                position={obstaclePos} 
                color={BRAND.orange[400]} 
                visorColor={BRAND.orange[200]} 
                opacity={useRawRig ? 0.3 : 0.92}
              />
              {useRawRig && rawSkeleton?.obstacle_markers && (
                <ViconSkeletonMesh markers={rawSkeleton.obstacle_markers} currentFrame={currentFrame} />
              )}
            </>
          ) : (
            <PhysicalPropMesh 
              position={obstaclePos} 
              trajectory={trajectories.obstacle}
              markers={rawSkeleton?.obstacle_markers} 
              currentFrame={currentFrame} 
            />
          )}
        </group>
      )}

      {/* Door Study */}
      {isDoorStudy && (
        <DoorMesh
          doorMarkers={rawSkeleton?.door_markers}
          doorSwingMarkers={rawSkeleton?.doorswing_markers}
          currentFrame={currentFrame}
        />
      )}

      {/* Secondary Prop Entities (Human vs Object) */}
      {hasPropData && (
        <group name="PropEntities">
          {isPropPerson ? (
             <>
               <PedestrianMesh
                 position={propPedestrianPos}
                 nextPosition={propPedestrianNext}
                 color="#f59e0b"
                 visorColor="#fbbf24"
                 opacity={useRawRig ? 0.3 : 0.92}
               />
               {useRawRig && rawSkeleton?.prop_markers && (
                  <ViconSkeletonMesh markers={rawSkeleton.prop_markers} currentFrame={currentFrame} />
               )}
             </>
          ) : (
            !hasFollower && (
              <PhysicalPropMesh
                position={rawPropPos}
                nextPosition={rawPropNext}
                trajectory={propTrajectory}
                markers={rawSkeleton?.prop_markers} 
                currentFrame={currentFrame}
              />
            )
          )}
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