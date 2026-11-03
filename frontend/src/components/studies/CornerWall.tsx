import { useMemo } from 'react';
import * as THREE from 'three';
import { BRAND } from '../../theme/brand';
import { CornerAngle, Vec2Tuple, Vec3Tuple } from '../../types/mocap';

interface CornerWallProps {
  angle?: CornerAngle;
  height?: number;
  thickness?: number;
}

interface WallSegment {
  length: number;
  position: Vec3Tuple;
  rotation: Vec3Tuple;
}

export function CornerWall({ angle = 90, height = 2.0, thickness = 0.08 }: CornerWallProps) {
  const apex: Vec2Tuple = [-0.325, 1.070];
  const wing1End: Vec2Tuple = [-0.568, 3.451];

  const wing2Configs: Record<CornerAngle, Vec2Tuple> = {
    45: [-2.032, 1.433],
    90: [-2.067, 0.841],
    135: [-1.880, 0.120],
  };

  const wing2End = wing2Configs[angle] ?? wing2Configs[90];

  const buildWallSegment = (p1: Vec2Tuple, p2: Vec2Tuple): WallSegment => {
    const dx = p2[0] - p1[0];
    const dz = p2[1] - p1[1];
    const length = Math.hypot(dx, dz);
    const midX = (p1[0] + p2[0]) / 2;
    const midZ = (p1[1] + p2[1]) / 2;
    const yaw = Math.atan2(dx, dz);

    return {
      length,
      position: [midX, height / 2, midZ],
      rotation: [0, yaw, 0],
    };
  };

  const wing1 = useMemo(() => buildWallSegment(apex, wing1End), [apex, wing1End, height]);
  const wing2 = useMemo(() => buildWallSegment(apex, wing2End), [apex, wing2End, height]);

  return (
    <group>
      {/* Wing 1 (Fixed Partition: ~2.39m) */}
      <group position={wing1.position} rotation={wing1.rotation}>
        <mesh receiveShadow castShadow>
          <boxGeometry args={[thickness, height, wing1.length]} />
          <meshStandardMaterial color="#1a293d" roughness={0.5} metalness={0.2} />
        </mesh>
        <mesh position={[0, height / 2 + 0.02, 0]}>
          <boxGeometry args={[thickness + 0.02, 0.04, wing1.length]} />
          <meshStandardMaterial color={BRAND.grey[300]} metalness={0.8} roughness={0.3} />
        </mesh>
      </group>

      {/* Wing 2 (Pivoting Partition: ~1.75m) */}
      <group position={wing2.position} rotation={wing2.rotation}>
        <mesh receiveShadow castShadow>
          <boxGeometry args={[thickness, height, wing2.length]} />
          <meshStandardMaterial color="#1a293d" roughness={0.5} metalness={0.2} />
        </mesh>
        <mesh position={[0, height / 2 + 0.02, 0]}>
          <boxGeometry args={[thickness + 0.02, 0.04, wing2.length]} />
          <meshStandardMaterial color={BRAND.grey[300]} metalness={0.8} roughness={0.3} />
        </mesh>
      </group>

      {/* Tracked Apex Edge Post */}
      <mesh position={[apex[0], height / 2, apex[1]]}>
        <cylinderGeometry args={[0.04, 0.04, height + 0.05, 16]} />
        <meshStandardMaterial
          color={BRAND.orange[400]}
          emissive={BRAND.orange[500]}
          emissiveIntensity={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* Floor Apex Target Ring */}
      <mesh position={[apex[0], 0.015, apex[1]]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.22, 0.32, 32]} />
        <meshBasicMaterial color={BRAND.orange[500]} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}