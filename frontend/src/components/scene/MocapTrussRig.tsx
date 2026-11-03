import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { BRAND } from '../../theme/brand';
import { Vec3Tuple } from '../../types/mocap';
import { MocapCamera } from './MocapCamera';

interface MocapTrussRigProps {
  size?: number;
  height?: number;
}

export function MocapTrussRig({ size = 20, height = 4.2 }: MocapTrussRigProps) {
  const half = size / 2;

  const cameraConfigs = useMemo<Array<{ pos: Vec3Tuple }>>(() => [
    // 4 Corner Overheads
    { pos: [-half + 0.5, height, -half + 0.5] },
    { pos: [half - 0.5, height, -half + 0.5] },
    { pos: [half - 0.5, height, half - 0.5] },
    { pos: [-half + 0.5, height, half - 0.5] },
    // 4 Mid-Span Overheads
    { pos: [0, height, -half + 0.5] },
    { pos: [half - 0.5, height, 0] },
    { pos: [0, height, half - 0.5] },
    { pos: [-half + 0.5, height, 0] },
  ], [half, height]);

  const cornerColumns: [number, number][] = [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ];

  return (
    <group>
      {/* 4 Corner Vertical Truss Columns */}
      {cornerColumns.map(([x, z], idx) => (
        <group key={`col-${idx}`} position={[x, height / 2, z]}>
          <mesh>
            <cylinderGeometry args={[0.06, 0.06, height, 16]} />
            <meshStandardMaterial color={BRAND.grey[600]} metalness={0.7} roughness={0.35} />
          </mesh>
          <mesh position={[0, -height / 2 + 0.05, 0]}>
            <boxGeometry args={[0.3, 0.1, 0.3]} />
            <meshStandardMaterial color={BRAND.navy[700]} roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Overhead Perimeter Crossbeams */}
      <Line
        points={[
          [-half, height, -half],
          [half, height, -half],
          [half, height, half],
          [-half, height, half],
          [-half, height, -half],
        ]}
        color={BRAND.grey[500]}
        lineWidth={3.5}
      />

      {/* Overhead Cable Harness Line */}
      <Line
        points={[
          [-half, height + 0.08, -half],
          [half, height + 0.08, -half],
          [half, height + 0.08, half],
          [-half, height + 0.08, half],
          [-half, height + 0.08, -half],
        ]}
        color={BRAND.cerulean[700]}
        lineWidth={1.2}
      />

      {/* Optical Cameras */}
      {cameraConfigs.map((cam, idx) => (
        <MocapCamera key={`mocap-cam-${idx}`} position={cam.pos} target={[0, 0.8, 0]} />
      ))}
    </group>
  );
}