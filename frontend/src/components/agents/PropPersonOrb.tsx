import React, { useMemo } from 'react';
import * as THREE from 'three';

interface PropPersonOrbProps {
  propTrajectory: [number, number, number][];
  currentFrame: number;
}

export const PropPersonOrb: React.FC<PropPersonOrbProps> = ({
  propTrajectory,
  currentFrame,
}) => {
  // Find first valid non-zero anchor as a fallback
  const firstValid = useMemo(() => {
    return propTrajectory.find((p) => p && (p[0] !== 0 || p[2] !== 0)) || [0, 1.6, 0];
  }, [propTrajectory]);

  const rawPos = propTrajectory[Math.min(currentFrame, propTrajectory.length - 1)];
  const isPosValid = rawPos && (rawPos[0] !== 0 || rawPos[2] !== 0);
  const pos = isPosValid ? rawPos : firstValid;

  // Breadcrumb trajectory path for the prop person
  const pathLine = useMemo(() => {
    const validPoints = propTrajectory
      .filter((p) => p && (p[0] !== 0 || p[2] !== 0))
      .map((p) => new THREE.Vector3(p[0], 0.03, p[2]));

    if (validPoints.length < 2) return null;

    const geom = new THREE.BufferGeometry().setFromPoints(validPoints);
    const line = new THREE.Line(geom);
    line.computeLineDistances();
    return line;
  }, [propTrajectory]);

  if (!pos) return null;

  const [x, y, z] = pos;
  const clampedY = y > 0.3 ? y : 1.60;

  return (
    <group name="PropPerson">
      {/* Ground Projection Trail */}
      {pathLine && (
        <primitive object={pathLine}>
          <lineDashedMaterial attach="material" color="#f59e0b" dashSize={0.25} gapSize={0.15} />
        </primitive>
      )}

      {/* Vertical Reference Guide to Floor */}
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

      {/* Ground Drop Ring */}
      <mesh position={[x, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.24, 32]} />
        <meshBasicMaterial color="#f59e0b" opacity={0.65} transparent side={THREE.DoubleSide} />
      </mesh>

      {/* Floating Orb */}
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
    </group>
  );
};