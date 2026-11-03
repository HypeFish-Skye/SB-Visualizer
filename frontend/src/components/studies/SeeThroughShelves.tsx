import { BRAND } from '../../theme/brand';
import { CorridorWidth, Vec3Tuple } from '../../types/mocap';

interface ShelfUnitProps {
  position: Vec3Tuple;
  length?: number;
  depth?: number;
  height?: number;
}

export function ShelfUnit({ position, length = 1.18, depth = 0.30, height = 1.35 }: ShelfUnitProps) {
  const shelfYLevels = [0.15, 0.50, 0.88, 1.25];
  const halfL = length / 2;
  const halfD = depth / 2;

  const uprights: [number, number][] = [
    [-halfD, -halfL],
    [halfD, -halfL],
    [halfD, halfL],
    [-halfD, halfL],
  ];

  return (
    <group position={position}>
      {/* 4 Structural Corner Uprights */}
      {uprights.map(([x, z], idx) => (
        <mesh key={idx} position={[x, height / 2, z]}>
          <boxGeometry args={[0.025, height, 0.025]} />
          <meshStandardMaterial color="#3a4556" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}

      {/* Translucent Acrylic Shelves */}
      {shelfYLevels.map((y, idx) => (
        <group key={idx} position={[0, y, 0]}>
          <mesh receiveShadow>
            <boxGeometry args={[depth, 0.015, length]} />
            <meshStandardMaterial
              color={BRAND.cerulean[200]}
              transparent
              opacity={0.32}
              roughness={0.15}
              metalness={0.1}
            />
          </mesh>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[depth + 0.005, 0.018, length + 0.005]} />
            <meshStandardMaterial color={BRAND.navy[400]} metalness={0.6} roughness={0.4} />
          </mesh>
        </group>
      ))}

      {/* Top Warning Cap */}
      <mesh position={[0, height + 0.01, 0]}>
        <boxGeometry args={[depth, 0.02, length]} />
        <meshStandardMaterial color={BRAND.navy[500]} metalness={0.5} roughness={0.5} />
      </mesh>
    </group>
  );
}

interface SeeThroughShelvesProps {
  corridorWidth?: CorridorWidth;
}

export function SeeThroughShelves({ corridorWidth = 'medium' }: SeeThroughShelvesProps) {
  const lateralConfig: Record<CorridorWidth, { leftX: number; rightX: number }> = {
    thin: { leftX: 0.55, rightX: -0.62 },
    medium: { leftX: 0.74, rightX: -0.82 },
    wide: { leftX: 1.01, rightX: -1.10 },
  };

  const { leftX, rightX } = lateralConfig[corridorWidth] ?? lateralConfig.medium;
  const zPositions = [4.01, 1.58, -0.85, -3.28];

  return (
    <group>
      {zPositions.map((z, idx) => (
        <ShelfUnit key={`left-${idx}`} position={[leftX + 0.15, 0, z]} />
      ))}
      {zPositions.map((z, idx) => (
        <ShelfUnit key={`right-${idx}`} position={[rightX - 0.15, 0, z]} />
      ))}
    </group>
  );
}