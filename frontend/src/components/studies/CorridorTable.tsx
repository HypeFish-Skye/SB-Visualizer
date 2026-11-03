import { BRAND } from '../../theme/brand';
import { CorridorWidth, TableSide } from '../../types/mocap';

interface CorridorTableProps {
  corridorWidth?: CorridorWidth;
  side?: TableSide;
}

export function CorridorTable({ corridorWidth = 'medium', side = 'left' }: CorridorTableProps) {
  const lateralConfig: Record<CorridorWidth, { leftX: number; rightX: number }> = {
    thin: { leftX: 0.55, rightX: -0.62 },
    medium: { leftX: 0.74, rightX: -0.82 },
    wide: { leftX: 1.01, rightX: -1.10 },
  };

  const { leftX, rightX } = lateralConfig[corridorWidth] ?? lateralConfig.medium;

  const tableWidth = 0.74;
  const tableLength = 1.80;
  const tableHeight = 0.75;
  const centerZ = 0.35;

  const posX = side === 'right' ? rightX + tableWidth / 2 : leftX - tableWidth / 2;
  const halfW = tableWidth / 2;
  const halfL = tableLength / 2;

  const legs: [number, number][] = [
    [-halfW + 0.06, -halfL + 0.08],
    [halfW - 0.06, -halfL + 0.08],
    [halfW - 0.06, halfL - 0.08],
    [-halfW + 0.06, halfL - 0.08],
  ];

  return (
    <group position={[posX, 0, centerZ]}>
      {/* Matte Laminate Tabletop */}
      <mesh position={[0, tableHeight - 0.02, 0]} receiveShadow castShadow>
        <boxGeometry args={[tableWidth, 0.04, tableLength]} />
        <meshStandardMaterial color="#223348" roughness={0.4} metalness={0.2} />
      </mesh>

      {/* Safety Tabletop Edge Bevel */}
      <mesh position={[0, tableHeight - 0.02, 0]}>
        <boxGeometry args={[tableWidth + 0.02, 0.02, tableLength + 0.02]} />
        <meshStandardMaterial color={BRAND.orange[400]} metalness={0.4} roughness={0.4} />
      </mesh>

      {/* 4 Legs */}
      {legs.map(([x, z], idx) => (
        <mesh key={idx} position={[x, (tableHeight - 0.04) / 2, z]}>
          <cylinderGeometry args={[0.02, 0.02, tableHeight - 0.04, 16]} />
          <meshStandardMaterial color={BRAND.grey[600]} metalness={0.8} roughness={0.3} />
        </mesh>
      ))}

      {/* Floor Footprint Glow */}
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[tableWidth, tableLength]} />
        <meshBasicMaterial color={BRAND.orange[500]} transparent opacity={0.18} />
      </mesh>
    </group>
  );
}