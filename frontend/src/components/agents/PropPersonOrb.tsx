import React, { useMemo } from 'react';
import * as THREE from 'three';

interface PropPersonOrbProps {
  propTrajectory: [number, number, number][];
  propMarkers?: Record<string, [number, number, number][]>;
  currentFrame: number;
}

export const PropPersonOrb: React.FC<PropPersonOrbProps> = ({
  propTrajectory = [],
  propMarkers,
  currentFrame,
}) => {
  const fIdx = Math.max(0, currentFrame);

  // 1. Resolve position: use propTrajectory or derive from current frame of propMarkers
  const currentPos = useMemo<[number, number, number] | null>(() => {
    if (propTrajectory.length > 0) {
      const p = propTrajectory[Math.min(fIdx, propTrajectory.length - 1)];
      if (p && (p[0] !== 0 || p[2] !== 0)) return p;
    }

    if (propMarkers) {
      const pts: [number, number, number][] = [];
      for (const stream of Object.values(propMarkers)) {
        const pt = stream[Math.min(fIdx, stream.length - 1)];
        if (pt && (pt[0] !== 0 || pt[2] !== 0)) {
          pts.push(pt);
        }
      }
      if (pts.length > 0) {
        const avgX = pts.reduce((acc, p) => acc + p[0], 0) / pts.length;
        const avgY = pts.reduce((acc, p) => acc + p[1], 0) / pts.length;
        const avgZ = pts.reduce((acc, p) => acc + p[2], 0) / pts.length;
        return [avgX, avgY, avgZ];
      }
    }

    // Default station fallback if stationary
    return null;
  }, [propTrajectory, propMarkers, fIdx]);

  // 2. Trajectory ground trail line
  const pathLine = useMemo(() => {
    if (!propTrajectory || propTrajectory.length < 2) return null;
    const validPoints = propTrajectory
      .filter((p) => p && (p[0] !== 0 || p[2] !== 0))
      .map((p) => new THREE.Vector3(p[0], 0.03, p[2]));

    if (validPoints.length < 2) return null;

    const geom = new THREE.BufferGeometry().setFromPoints(validPoints);
    const line = new THREE.Line(geom);
    line.computeLineDistances();
    return line;
  }, [propTrajectory]);

  // 3. Current frame positions of individual optical markers (M_1..M_5)
  const markerSpheres = useMemo(() => {
    if (!propMarkers) return [];
    const spheres: [number, number, number][] = [];
    for (const stream of Object.values(propMarkers)) {
      const pt = stream[Math.min(fIdx, stream.length - 1)];
      if (pt && (pt[0] !== 0 || pt[2] !== 0)) {
        spheres.push(pt);
      }
    }
    return spheres;
  }, [propMarkers, fIdx]);

  if (!currentPos) return null;

  const [x, y, z] = currentPos;
  const clampedY = y > 0.3 ? y : 1.60;

  return (
    <group name="PropPerson">
      {/* Floor Projection Trail */}
      {pathLine && (
        <primitive object={pathLine}>
          <lineDashedMaterial attach="material" color="#f59e0b" dashSize={0.25} gapSize={0.15} />
        </primitive>
      )}

      {/* Vertical Floor Tether Guide */}
      <line>
        <bufferGeometry
          attach="geometry"
          onUpdate={(geom) => {
            geom.setFromPoints([
              new THREE.Vector3(x, 0.02, z),
              new THREE.Vector3(x, clampedY, z),
            ]);
          }}
        />
        <lineBasicMaterial color="#d97706" opacity={0.4} transparent />
      </line>

      {/* Ground Ring Anchor */}
      <mesh position={[x, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.24, 32]} />
        <meshBasicMaterial color="#f59e0b" opacity={0.65} transparent side={THREE.DoubleSide} />
      </mesh>

      {/* Floating Centroid Orb */}
      <mesh position={[x, clampedY, z]} castShadow>
        <sphereGeometry args={[0.16, 32, 32]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#d97706"
          emissiveIntensity={0.8}
          roughness={0.2}
          metalness={0.3}
        />
      </mesh>

      {/* 5 Optical Vicon Marker Spheres (if raw markers present) */}
      {markerSpheres.map((pt, idx) => (
        <mesh key={idx} position={pt}>
          <sphereGeometry args={[0.016, 16, 16]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#fbbf24"
            emissiveIntensity={0.9}
            roughness={0.15}
            metalness={0.8}
          />
        </mesh>
      ))}
    </group>
  );
};