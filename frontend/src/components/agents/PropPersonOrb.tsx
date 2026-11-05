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
  const pos = propTrajectory[Math.min(currentFrame, propTrajectory.length - 1)];

  // Breadcrumb trajectory path for the prop person
  const pathGeometry = useMemo(() => {
    const points = propTrajectory.map((p) => new THREE.Vector3(p[0], 0.03, p[2]));
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [propTrajectory]);
  const pathLine = useMemo(() => {
    const line = new THREE.Line(pathGeometry);
    line.computeLineDistances();
    return line;
  }, [pathGeometry]);

  if (!pos || (pos[0] === 0 && pos[1] === 0 && pos[2] === 0)) return null;

  return (
    <group>
      {/* Ground Projection Trail */}
      <primitive object={pathLine}>
        <lineDashedMaterial attach="material" color="#f59e0b" dashSize={0.2} gapSize={0.1} />
      </primitive>

      {/* Vertical Reference Guide to Floor */}
      <line>
        <bufferGeometry
          attach="geometry"
          onUpdate={(geom) => {
            geom.setFromPoints([
              new THREE.Vector3(pos[0], 0, pos[2]),
              new THREE.Vector3(pos[0], pos[1], pos[2]),
            ]);
          }}
        />
        <lineBasicMaterial color="#d97706" opacity={0.5} transparent />
      </line>

      {/* Ground Drop Ring */}
      <mesh position={[pos[0], 0.02, pos[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.22, 32]} />
        <meshBasicMaterial color="#f59e0b" opacity={0.6} transparent />
      </mesh>

      {/* Floating Orb */}
      <mesh position={[pos[0], pos[1], pos[2]]}>
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