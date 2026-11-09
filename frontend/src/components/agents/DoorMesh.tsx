import React, { useMemo } from 'react';
import * as THREE from 'three';

interface DoorMeshProps {
  doorMarkers?: Record<string, [number, number, number]>;
  doorSwingMarkers?: Record<string, [number, number, number][]>;
  currentFrame: number;
}

// Fixed real-world laboratory doorway dimensions (constant across all trials)
const CANONICAL_DOOR = {
  // Clear opening inner bounds
  leftJambX: -0.360,    // Left strike jamb inner face (meters)
  rightJambX: 0.500,    // Right hinge jamb inner face (meters)
  clearWidth: 0.860,    // Clear passage width (0.50 - (-0.36) = 0.86 m)
  clearHeight: 2.060,   // Standard 2.06 m door frame opening height
  frameZ: 0.350,        // Door frame center plane in MoCap lab coordinates
  
  // Jamb and header beam dimensions
  postThickness: 0.08,  // Width of frame posts (8 cm)
  postDepth: 0.12,      // Casing depth (12 cm)

  // Door leaf panel (sized to fit cleanly inside the frame)
  doorWidth: 0.840,     // 84 cm wide leaf (leaving a 1 cm margin inside the 86 cm opening)
  doorHeight: 2.040,    // 2.04 m height (leaving 2 cm margin under the 2.06 m header)
  doorThickness: 0.038, // Standard 1.5-inch (3.8 cm) door slab
};

export const DoorMesh: React.FC<DoorMeshProps> = ({
  doorMarkers,
  doorSwingMarkers,
  currentFrame,
}) => {
    // Guard clause: if no door markers are provided, render nothing
    const hasDoorMarkers = Boolean(
    (doorMarkers && Object.keys(doorMarkers).length > 0) ||
    (doorSwingMarkers && Object.keys(doorSwingMarkers).length > 0)
  );

  if (!hasDoorMarkers) {
    return null;
  }


  // 1. Calculate dynamic door swing angle directly aligned with the marker plane
  const swingAngle = useMemo(() => {
    if (!doorSwingMarkers) return 0;

    const hingeX = CANONICAL_DOOR.rightJambX;
    const hingeZ = CANONICAL_DOOR.frameZ;

    const candidateMarkers = ['M_1', 'M_2', 'M_3', 'M_4', 'M_5'];
    const angles: number[] = [];

    for (const m of candidateMarkers) {
      const stream = doorSwingMarkers[m];
      if (!stream || stream.length === 0) continue;

      const idx = Math.min(currentFrame, stream.length - 1);
      const pt = stream[idx];
      // Skip untracked / zero coordinates
      if (!pt || (pt[0] === 0 && pt[1] === 0 && pt[2] === 0)) continue;

      const dx = pt[0] - hingeX;
      const dz = pt[2] - hingeZ;

      // When closed, the door points towards -X (dx < 0, dz ~ 0).
      // In Three.js, rotation around Y rotates [-1, 0, 0] by theta into [-cos(theta), 0, sin(theta)].
      // Matching (dx, dz) gives: rotation.y = atan2(dz, -dx)
      const ang = Math.atan2(dz, -dx);
      angles.push(ang);
    }

    if (angles.length === 0) return 0;

    // Use median angle for robustness against momentary marker occlusions
    angles.sort((a, b) => a - b);
    return angles[Math.floor(angles.length / 2)];
  }, [doorSwingMarkers, currentFrame]);

  const centerX = (CANONICAL_DOOR.leftJambX + CANONICAL_DOOR.rightJambX) / 2;

  return (
    <group name="DoorSystem">
      {/* ========================================================== */}
      {/* 1. FIXED PERIMETER DOOR FRAME (Constant Shape & Position)   */}
      {/* ========================================================== */}
      <group name="DoorFrameStatic">
        {/* Left Jamb Post (Strike Side) */}
        <mesh
          position={[
            CANONICAL_DOOR.leftJambX - CANONICAL_DOOR.postThickness / 2,
            CANONICAL_DOOR.clearHeight / 2,
            CANONICAL_DOOR.frameZ,
          ]}
        >
          <boxGeometry
            args={[CANONICAL_DOOR.postThickness, CANONICAL_DOOR.clearHeight, CANONICAL_DOOR.postDepth]}
          />
          <meshStandardMaterial color="#0284c7" opacity={0.35} transparent depthWrite={false} />
        </mesh>

        {/* Right Jamb Post (Hinge Side) */}
        <mesh
          position={[
            CANONICAL_DOOR.rightJambX + CANONICAL_DOOR.postThickness / 2,
            CANONICAL_DOOR.clearHeight / 2,
            CANONICAL_DOOR.frameZ,
          ]}
        >
          <boxGeometry
            args={[CANONICAL_DOOR.postThickness, CANONICAL_DOOR.clearHeight, CANONICAL_DOOR.postDepth]}
          />
          <meshStandardMaterial color="#0284c7" opacity={0.35} transparent depthWrite={false} />
        </mesh>

        {/* Top Header Lintel */}
        <mesh
          position={[
            centerX,
            CANONICAL_DOOR.clearHeight + CANONICAL_DOOR.postThickness / 2,
            CANONICAL_DOOR.frameZ,
          ]}
        >
          <boxGeometry
            args={[
              CANONICAL_DOOR.clearWidth + CANONICAL_DOOR.postThickness * 2,
              CANONICAL_DOOR.postThickness,
              CANONICAL_DOOR.postDepth,
            ]}
          />
          <meshStandardMaterial color="#0284c7" opacity={0.35} transparent depthWrite={false} />
        </mesh>

        {/* Optical Marker Spheres (Door:M_1..5) - shows raw placement without altering frame shape */}
        {doorMarkers &&
          Object.entries(doorMarkers).map(([name, pt]) => (
            <mesh key={`door-marker-${name}`} position={pt}>
              <sphereGeometry args={[0.015, 16, 16]} />
              <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={0.8} />
            </mesh>
          ))}
      </group>

      {/* ========================================================== */}
      {/* 2. DYNAMIC DOOR SWING LEAF (Rotates on Hinge Post)         */}
      {/* ========================================================== */}
      <group name="DoorSwingSystem">
        {/* Optical Tracking Marker Spheres (DoorSwing:M_1..5) */}
        {doorSwingMarkers &&
          Object.entries(doorSwingMarkers).map(([name, stream]) => {
            const pt = stream[Math.min(currentFrame, stream.length - 1)];
            if (!pt || (pt[0] === 0 && pt[1] === 0 && pt[2] === 0)) return null;
            return (
              <mesh key={`doorswing-marker-${name}`} position={pt}>
                <sphereGeometry args={[0.016, 16, 16]} />
                <meshStandardMaterial color="#10b981" emissive="#059669" emissiveIntensity={0.8} />
              </mesh>
            );
          })}

        {/* 
          Hinged Door Leaf Pivot:
          Anchored at the right jamb (X = 0.50, Z = 0.35).
          Rotates around Y using swingAngle.
        */}
        <group
          position={[CANONICAL_DOOR.rightJambX, 0, CANONICAL_DOOR.frameZ]}
          rotation={[0, swingAngle, 0]}
        >
          {/* 
            Door leaf panel:
            Extends in -X from the hinge, spanning 0.84 m across to fit inside the 0.86 m opening.
          */}
          <mesh
            position={[
              -CANONICAL_DOOR.doorWidth / 2,
              CANONICAL_DOOR.doorHeight / 2,
              0,
            ]}
          >
            <boxGeometry
              args={[
                CANONICAL_DOOR.doorWidth,
                CANONICAL_DOOR.doorHeight,
                CANONICAL_DOOR.doorThickness,
              ]}
            />
            <meshStandardMaterial
              color="#10b981"
              opacity={0.45}
              transparent
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Door Handle accent near the strike edge */}
          <mesh position={[-CANONICAL_DOOR.doorWidth + 0.07, 0.98, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.12, 16]} />
            <meshStandardMaterial color="#f8fafc" metalness={0.9} roughness={0.1} />
          </mesh>
        </group>
      </group>
    </group>
  );
};