import React, { useMemo } from 'react';
import * as THREE from 'three';
import { WallPlaneData } from '../../types/types.js';

interface WallPlaneProps {
  wall: WallPlaneData;
}

export const WallPlaneMesh: React.FC<WallPlaneProps> = ({ wall }) => {
  const { geometry, edgesGeometry } = useMemo(() => {
    const [c0, c1, c2, c3] = wall.corners; // BL, BR, TR, TL

    // Two triangles forming the vertical quad
    const vertices = new Float32Array([
      ...c0, ...c1, ...c2, // Triangle 1
      ...c0, ...c2, ...c3, // Triangle 2
    ]);

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geom.computeVertexNormals();

    const edges = new THREE.EdgesGeometry(geom);
    return { geometry: geom, edgesGeometry: edges };
  }, [wall]);

  return (
    <group>
      {/* Translucent Wall Surface */}
      <mesh geometry={geometry}>
        <meshPhysicalMaterial
          color="#38bdf8"
          transmission={0.65}
          opacity={0.45}
          transparent={true}
          roughness={0.15}
          metalness={0.1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Structural Border Frame */}
      <lineSegments geometry={edgesGeometry}>
        <lineBasicMaterial color="#0284c7" linewidth={2} />
      </lineSegments>
    </group>
  );
};