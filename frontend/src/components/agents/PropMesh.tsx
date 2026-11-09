import React, { useMemo } from 'react';
import * as THREE from 'three';

interface PropMeshProps {
  propTrajectory: [number, number, number][];
  propMarkers?: Record<string, [number, number, number][]>;
  currentFrame: number;
  propType?: 'person' | 'shelf' | 'stroller' | 'generic';
}

export const PropMesh: React.FC<PropMeshProps> = ({
  propTrajectory,
  propMarkers,
  currentFrame,
  propType = 'generic',
}) => {
  const rawPos = propTrajectory[Math.min(currentFrame, propTrajectory.length - 1)];
  const isPosValid = rawPos && (rawPos[0] !== 0 || rawPos[2] !== 0);
  if (!isPosValid && (!propMarkers || Object.keys(propMarkers).length === 0)) return null;

  const [x, y, z] = rawPos || [0, 0.8, 0];

  return (
    <group name="PropSystem">
      {/* 1. Raw Mocap Prop Cluster Spheres (if raw markers exist) */}
      {propMarkers &&
        Object.entries(propMarkers).map(([name, stream]) => {
          const pt = stream[Math.min(currentFrame, stream.length - 1)];
          if (!pt || (pt[0] === 0 && pt[1] === 0 && pt[2] === 0)) return null;
          return (
            <mesh key={`prop-marker-${name}`} position={pt}>
              <sphereGeometry args={[0.016, 16, 16]} />
              <meshStandardMaterial color="#f59e0b" emissive="#d97706" emissiveIntensity={0.8} />
            </mesh>
          );
        })}

      {/* 2. Generalized Representation by Prop Type */}
      {propType === 'person' ? (
        // ReadingWallIntentions Prop Person: Floating Human Orb at Chest/Head Height
        <group position={[x, y > 0.4 ? y : 1.55, z]}>
          <mesh castShadow>
            <sphereGeometry args={[0.16, 32, 32]} />
            <meshStandardMaterial color="#fbbf24" emissive="#d97706" emissiveIntensity={0.6} roughness={0.2} />
          </mesh>
          <mesh position={[0, -y + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.18, 0.24, 32]} />
            <meshBasicMaterial color="#f59e0b" opacity={0.65} transparent side={THREE.DoubleSide} />
          </mesh>
        </group>
      ) : propType === 'shelf' ? (
        // DoorsWide Movable Shelf: Low-profile Industrial Utility Cart / Shelf Bounds
        <group position={[x, y / 2, z]}>
          <mesh castShadow>
            <boxGeometry args={[0.55, y, 0.45]} />
            <meshStandardMaterial color="#64748b" opacity={0.5} transparent roughness={0.4} metalness={0.6} />
          </mesh>
        </group>
      ) : (
        // Generic Physical Object Payload
        <group position={[x, y / 2, z]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.22, 0.22, y, 24]} />
            <meshStandardMaterial color="#f59e0b" opacity={0.5} transparent roughness={0.3} />
          </mesh>
        </group>
      )}
    </group>
  );
};