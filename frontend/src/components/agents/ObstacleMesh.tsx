import { BRAND } from '../../theme/brand';
import { Vec3Tuple } from '../../types/mocap';

interface ObstacleMeshProps {
  position?: Vec3Tuple;
}

export function ObstacleMesh({ position }: ObstacleMeshProps) {
  if (!position) return null;

  return (
    <group position={position}>
      {/* Safety Orange Body */}
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.20, 0.24, 0.9, 24]} />
        <meshStandardMaterial color={BRAND.orange[500]} roughness={0.3} metalness={0.1} />
      </mesh>

      {/* Beige Reflective Band */}
      <mesh position={[0, 0.65, 0]}>
        <cylinderGeometry args={[0.21, 0.21, 0.16, 24]} />
        <meshStandardMaterial color={BRAND.beige[100]} emissive={BRAND.beige[200]} emissiveIntensity={0.5} />
      </mesh>

      {/* Weighted Base */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.28, 0.30, 0.1, 24]} />
        <meshStandardMaterial color={BRAND.navy[700]} roughness={0.8} />
      </mesh>
    </group>
  );
}