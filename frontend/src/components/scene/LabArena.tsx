import { ContactShadows, Grid, Line } from '@react-three/drei';
import { BRAND } from '../../theme/brand.js';
import { CornerAngle, OvertakingConfig, WallPlaneData } from '../../types/types.js';
import { CornerWall } from '../studies/CornerWall.js';
import { CorridorTable } from '../studies/CorridorTable.js';
import { SeeThroughShelves } from '../studies/SeeThroughShelves.js';
import { WallPlaneMesh } from '../studies/WallPlane.js';
import { MocapTrussRig } from './MocapTrussRig.js';

interface LabArenaProps {
  size?: number;
  cornerAngle?: CornerAngle | null;
  overtakingConfig?: OvertakingConfig | null;
  wallPlane?: WallPlaneData | null;
  isReadingWall?: boolean;
}

export function LabArena({
  size = 20,
  cornerAngle = null,
  overtakingConfig = null,
  isReadingWall = false,
}: LabArenaProps) {
  const half = size / 2;

  return (
    <group position={[0, -0.01, 0]}>
      {/* 1. Epoxy Lab Floor */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#071424" roughness={0.22} metalness={0.35} />
      </mesh>

      {/* 2. Contact Shadows */}
      <ContactShadows
        position={[0, 0.005, 0]}
        opacity={0.7}
        scale={size}
        blur={1.6}
        far={3.2}
        resolution={512}
        color="#000000"
      />

      {/* 3. Perimeter Boundary */}
      <Line
        points={[
          [-half, 0.01, -half],
          [half, 0.01, -half],
          [half, 0.01, half],
          [-half, 0.01, half],
          [-half, 0.01, -half],
        ]}
        color={BRAND.cerulean[500]}
        lineWidth={3.5}
      />

      {/* 4. Coordinate Grid */}
      <Grid
        position={[0, 0.005, 0]}
        args={[size, size]}
        sectionColor={BRAND.navy[400]}
        cellColor={BRAND.navy[600]}
        sectionSize={2.0}
        cellSize={0.5}
        fadeDistance={38}
        infiniteGrid={false}
      />

      {/* 5. Overhead Truss & Cameras */}
      <MocapTrussRig size={size} height={4.2} />

      {/* 6. Dynamic Corner Wall (Cornering Study) */}
      {cornerAngle !== null && <CornerWall angle={cornerAngle} />}

      {/* 7. Shelves and Table (OvertakingBypassing Study) */}
      {overtakingConfig && (
        <group position={[4.25, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <SeeThroughShelves corridorWidth={overtakingConfig.corridorWidth} />
          {overtakingConfig.isNarrow && (
            <CorridorTable
              corridorWidth={overtakingConfig.corridorWidth}
              side={overtakingConfig.side}
            />
          )}
        </group>
      )}

      {/* 8. Static Reading Wall (ReadingWallIntentions Study) */}
      {(isReadingWall) && (
        <WallPlaneMesh width={3.0} />
      )}
    </group>
  );
}