import * as THREE from 'three';
import { BRAND } from '../../theme/brand.js';
import { Vec3Tuple } from '../../types/types.js';
import { computeHeading } from '../../utils/mocapMath.js';
  
interface PedestrianMeshProps {
  position?: Vec3Tuple;
  nextPosition?: Vec3Tuple;
  color?: string;
  visorColor?: string;
}

export function PedestrianMesh({
  position,
  nextPosition,
  color = BRAND.beige[100],
  visorColor = BRAND.cerulean[400],
}: PedestrianMeshProps) {
  if (!position) return null;
  const heading = computeHeading(position, nextPosition);

  return (
    <group position={position} rotation={[0, heading, 0]}>
      {/* Ground Footprint Ring */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.16, 0.20, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.65} side={THREE.DoubleSide} />
      </mesh>

      {/* Torso Capsule */}
      <mesh position={[0, 0.75, 0]}>
        <capsuleGeometry args={[0.13, 0.7, 8, 16]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.1} transparent opacity={0.92} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.45, 0]}>
        <sphereGeometry args={[0.11, 16, 16]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.1} transparent opacity={0.92} />
      </mesh>

      {/* Forward Heading Visor */}
      <mesh position={[0, 0.85, 0.13]}>
        <boxGeometry args={[0.10, 0.06, 0.05]} />
        <meshStandardMaterial color={visorColor} emissive={visorColor} emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}