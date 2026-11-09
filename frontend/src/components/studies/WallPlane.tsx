import React, { useMemo } from 'react';
import * as THREE from 'three';
import { WallPlaneData } from '../../types/types.js';
import { BRAND } from '../../theme/brand.js';

// Physical Vicon optical marker positions in Three.js coordinates (meters)
export const VICON_WALL_MARKERS: [number, number, number][] = [
  [0.390, 1.499, 0.612],  // M_1
  [0.388, 2.052, 0.610],  // M_2
  [-0.160, 1.748, 0.611], // M_3
  [-0.194, 2.002, 0.614], // M_4
  [-0.448, 1.500, 0.613], // M_5
  [0.111, 1.809, 0.615],  // M_6
  [-0.013, 1.963, 0.617], // M_7
];

interface WallPlaneProps {
  wall?: WallPlaneData | null;
  /** Width in meters across the lab X-axis. Defaults to 2.8m */
  width?: number;
  /** Height in meters from floor plane. Defaults to 2.1m */
  height?: number;
  showMarkers?: boolean;
}

export const WallPlaneMesh: React.FC<WallPlaneProps> = ({
  wall = null,
  width = 2.8,
  height = 2.1,
  showMarkers = true,
}) => {
  // Use wall center if provided, otherwise default to median Vicon marker anchor
  const centerX = wall?.center?.[0] ?? -0.029;
  const centerZ = wall?.center?.[2] ?? 0.613;
  const wallHeight = wall?.height ?? height;
  const wallWidth = width;

  const halfW = wallWidth / 2;

  // 4 corners of the widened vertical quad: BL, BR, TR, TL
  const corners = useMemo(() => {
    return [
      [centerX - halfW, 0.0, centerZ],        // Bottom-Left
      [centerX + halfW, 0.0, centerZ],        // Bottom-Right
      [centerX + halfW, wallHeight, centerZ], // Top-Right
      [centerX - halfW, wallHeight, centerZ], // Top-Left
    ] as [number, number, number][];
  }, [centerX, centerZ, halfW, wallHeight]);

  const { geometry, edgesGeometry } = useMemo(() => {
    const [c0, c1, c2, c3] = corners;

    const vertices = new Float32Array([
      ...c0, ...c1, ...c2, // Tri 1
      ...c0, ...c2, ...c3, // Tri 2
    ]);

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geom.computeVertexNormals();

    const edges = new THREE.EdgesGeometry(geom);
    return { geometry: geom, edgesGeometry: edges };
  }, [corners]);

  return (
    <group name="ReadingWallFixture">
      {/* 1. Translucent Partition Wall Surface */}
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={BRAND.cerulean[400]}
          transparent
          opacity={0.32}
          roughness={0.18}
          metalness={0.1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* 2. Structural Border Outline */}
      <lineSegments geometry={edgesGeometry}>
        <lineBasicMaterial color={BRAND.cerulean[500]} linewidth={2.5} />
      </lineSegments>

      {/* 3. Center Target Reading Board / Paper Zone */}
      <mesh position={[centerX, 1.75, centerZ + 0.003]}>
        <planeGeometry args={[1.0, 0.6]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.4} side={THREE.DoubleSide} />
      </mesh>

      {/* 4. Floor Mounting Foot Plates */}
      <mesh position={[centerX - halfW * 0.85, 0.015, centerZ]}>
        <boxGeometry args={[0.1, 0.03, 0.5]} />
        <meshStandardMaterial color={BRAND.navy[400]} roughness={0.3} metalness={0.7} />
      </mesh>
      <mesh position={[centerX + halfW * 0.85, 0.015, centerZ]}>
        <boxGeometry args={[0.1, 0.03, 0.5]} />
        <meshStandardMaterial color={BRAND.navy[400]} roughness={0.3} metalness={0.7} />
      </mesh>

      {/* 5. Physical Optical Vicon Markers */}
      {showMarkers &&
        VICON_WALL_MARKERS.map(([mx, my, mz], idx) => (
          <mesh key={idx} position={[mx, my, mz]}>
            <sphereGeometry args={[0.015, 16, 16]} />
            <meshStandardMaterial
              color="#e2e8f0"
              emissive={BRAND.cerulean[300]}
              emissiveIntensity={0.65}
              roughness={0.2}
              metalness={0.8}
            />
          </mesh>
        ))}
    </group>
  );
};