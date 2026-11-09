import React, { useMemo } from 'react';
import * as THREE from 'three';

interface PhysicalPropMeshProps {
  trajectory: [number, number, number][];
  markers?: Record<string, [number, number, number][]>;
  currentFrame: number;
}

export const PhysicalPropMesh: React.FC<PhysicalPropMeshProps> = ({
  trajectory,
  markers,
  currentFrame,
}) => {
  const currentPos = trajectory[Math.min(currentFrame, trajectory.length - 1)];
  const hasValidPos = currentPos && (currentPos[0] !== 0 || currentPos[2] !== 0);

  const pathLine = useMemo(() => {
    const pts = trajectory
      .filter((p) => p && (p[0] !== 0 || p[2] !== 0))
      .map((p) => new THREE.Vector3(p[0], 0.03, p[2]));
    if (pts.length < 2) return null;
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geom);
    line.computeLineDistances();
    return line;
  }, [trajectory]);

  if (!hasValidPos && (!markers || Object.keys(markers).length === 0)) return null;
  const [x, y, z] = currentPos || [0, 0.7, 0];
  const objHeight = Math.max(y, 0.65);

  return (
    <group name="PhysicalProp">
      {/* Ground Path Trail */}
      {pathLine && (
        <primitive object={pathLine}>
          <lineDashedMaterial attach="material" color="#f59e0b" dashSize={0.25} gapSize={0.15} />
        </primitive>
      )}

      {/* Optical Marker Spheres (Yellow/Amber) */}
      {markers &&
        Object.entries(markers).map(([name, stream]) => {
          const pt = stream[Math.min(currentFrame, stream.length - 1)];
          if (!pt || (pt[0] === 0 && pt[1] === 0 && pt[2] === 0)) return null;
          return (
            <mesh key={`prop-marker-${name}`} position={pt}>
              <sphereGeometry args={[0.018, 16, 16]} />
              <meshStandardMaterial color="#f59e0b" emissive="#d97706" emissiveIntensity={0.8} />
            </mesh>
          );
        })}

      {/* Physical Accompaniment Object Chassis (Shelf / Cart / Wagon / Stroller) */}
      <group position={[x, objHeight / 2, z]}>
        <mesh castShadow>
          <boxGeometry args={[0.60, objHeight, 0.50]} />
          <meshStandardMaterial color="#64748b" opacity={0.5} transparent roughness={0.4} metalness={0.6} />
        </mesh>
        <mesh position={[0, -objHeight / 2 + 0.05, 0]}>
          <boxGeometry args={[0.62, 0.04, 0.52]} />
          <meshStandardMaterial color="#334155" metalness={0.8} />
        </mesh>
      </group>
    </group>
  );
};