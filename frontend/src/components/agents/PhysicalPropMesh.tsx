import React, { useMemo } from 'react';
import * as THREE from 'three';

interface PhysicalPropMeshProps {
  position?: [number, number, number];
  nextPosition?: [number, number, number];
  trajectory?: [number, number, number][];
  markers?: Record<string, [number, number, number][]>;
  currentFrame: number;
}

export const PhysicalPropMesh: React.FC<PhysicalPropMeshProps> = ({
  position,
  nextPosition,
  trajectory = [],
  markers,
  currentFrame,
}) => {
  // Determine active coordinate from explicit position prop or trajectory array
  const activePos = position || trajectory[Math.min(currentFrame, trajectory.length - 1)];
  const hasValidPos = activePos && (activePos[0] !== 0 || activePos[2] !== 0);

  // Compute orientation heading if moving
  const heading = useMemo(() => {
    if (!activePos) return 0;
    const next = nextPosition || trajectory[Math.min(currentFrame + 1, trajectory.length - 1)];
    if (!next) return 0;
    const dx = next[0] - activePos[0];
    const dz = next[2] - activePos[2];
    return Math.hypot(dx, dz) > 0.005 ? Math.atan2(dx, dz) : 0;
  }, [activePos, nextPosition, trajectory, currentFrame]);

  if (!hasValidPos && (!markers || Object.keys(markers).length === 0)) return null;
  const [x, y, z] = activePos || [0, 0.65, 0];
  const objHeight = Math.max(y, 0.65);

  return (
    <group name="PhysicalProp">
      {/* 1. Optical Tracking Marker Spheres (Yellow/Amber) */}
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

      {/* 2. Physical Object Chassis (Wagon / Cart / Shelf / Stroller) */}
      <group position={[x, objHeight / 2, z]} rotation={[0, heading, 0]}>
        {/* Main Cargo Box / Basket */}
        <mesh castShadow>
          <boxGeometry args={[0.60, objHeight, 0.48]} />
          <meshStandardMaterial color="#475569" opacity={0.55} transparent roughness={0.4} metalness={0.6} />
        </mesh>
        {/* Reinforced Top Rim & Base */}
        <mesh position={[0, objHeight / 2 - 0.01, 0]}>
          <boxGeometry args={[0.62, 0.02, 0.50]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} />
        </mesh>
        <mesh position={[0, -objHeight / 2 + 0.02, 0]}>
          <boxGeometry args={[0.62, 0.04, 0.50]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} />
        </mesh>
      </group>
    </group>
  );
};