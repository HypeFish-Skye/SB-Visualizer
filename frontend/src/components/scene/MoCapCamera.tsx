import { useMemo } from 'react';
import * as THREE from 'three';
import { BRAND } from '../../theme/brand';
import { Vec3Tuple } from '../../types/mocap';

interface MocapCameraProps {
  position: Vec3Tuple;
  target?: Vec3Tuple;
}

export function MocapCamera({ position, target = [0, 0.8, 0] }: MocapCameraProps) {
  const rotation = useMemo(() => {
    const dummy = new THREE.Object3D();
    dummy.position.set(...position);
    dummy.lookAt(target[0], target[1], target[2]);
    return dummy.rotation;
  }, [position, target]);

  return (
    <group position={position} rotation={rotation}>
      {/* Mounting Clamp to Truss */}
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.12, 12]} />
        <meshStandardMaterial color={BRAND.grey[700]} metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Camera Body (Vicon/Qualisys Form Factor) */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.18, 0.16, 0.24]} />
        <meshStandardMaterial color="#0e1724" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Optical Lens */}
      <mesh position={[0, 0, 0.13]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 0.05, 16]} />
        <meshStandardMaterial color="#05080d" roughness={0.1} metalness={0.9} />
      </mesh>

      {/* Active Infrared Strobe Ring */}
      <mesh position={[0, 0, 0.155]}>
        <ringGeometry args={[0.06, 0.075, 24]} />
        <meshBasicMaterial color={BRAND.orange[400]} />
      </mesh>

      {/* Front Status LED Indicator */}
      <mesh position={[0.06, 0.055, 0.122]}>
        <sphereGeometry args={[0.012, 12, 12]} />
        <meshBasicMaterial color={BRAND.cerulean[400]} />
      </mesh>
    </group>
  );
}