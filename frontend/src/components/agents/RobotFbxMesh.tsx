import { useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { FBXLoader } from 'three-stdlib';
import * as THREE from 'three';
import { BRAND } from '../../theme/brand.js';
import { Vec3Tuple } from '../../types/mocap.js';
import { computeHeading } from '../../utils/mocapMath.js';

interface RobotFbxMeshProps {
  position?: Vec3Tuple;
  nextPosition?: Vec3Tuple;
  targetHeight?: number;
  rotationOffset?: Vec3Tuple;
}

export function RobotFbxMesh({
  position,
  nextPosition,
  targetHeight = 0.6,
  rotationOffset = [-Math.PI / 2, 0, 0],
}: RobotFbxMeshProps) {
  // 1. Hooks MUST run unconditionally first
  const fbx = useLoader(FBXLoader, 'models/robot.fbx');

  const normalizedModel = useMemo(() => {
    if (!fbx) return null;
    const clone = fbx.clone(true);
    clone.rotation.set(rotationOffset[0], rotationOffset[1], rotationOffset[2]);
    clone.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const scaleFactor = maxDim > 0 ? targetHeight / maxDim : 0.01;
    clone.scale.setScalar(scaleFactor);

    box.setFromObject(clone);
    box.getCenter(center);
    clone.position.x = -center.x;
    clone.position.y = -box.min.y;
    clone.position.z = -center.z;

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((mat) => {
          if (mat instanceof THREE.MeshStandardMaterial) {
            mat.roughness = 0.4;
            mat.metalness = 0.2;
            mat.needsUpdate = true;
          }
        });
      }
    });

    const wrapper = new THREE.Group();
    wrapper.add(clone);
    return wrapper;
  }, [fbx, targetHeight, rotationOffset]);

  // 2. Conditional render happens strictly AFTER hooks have fired
  if (!position || !normalizedModel) return null;

  const heading = computeHeading(position, nextPosition);

  return (
    <group position={position} rotation={[0, heading, 0]}>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.26, 0.3, 32]} />
        <meshBasicMaterial color={BRAND.cerulean[400]} transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
      <primitive object={normalizedModel} />
    </group>
  );
}