import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { CameraMode, Vec3Tuple } from '../../types/mocap';
import { computeHeading } from '../../utils/mocapMath';

interface CameraRigProps {
  mode: CameraMode;
  targetPos?: Vec3Tuple;
  nextPos?: Vec3Tuple;
  leaderPos?: Vec3Tuple;
}

export function CameraRig({ mode, targetPos, nextPos, leaderPos }: CameraRigProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);

  useFrame(({ camera }) => {
    if (!targetPos) return;

    if (mode === 'chase') {
      const heading = computeHeading(targetPos, nextPos);
      let camAngle = heading;

      if (leaderPos) {
        const dx = leaderPos[0] - targetPos[0];
        const dz = leaderPos[2] - targetPos[2];
        const fwdX = Math.sin(heading);
        const fwdZ = Math.cos(heading);
        const dot = fwdX * dx + fwdZ * dz;

        if (dot < 0) {
          const cross = fwdX * dz - fwdZ * dx;
          camAngle = heading + (cross > 0 ? 0.65 : -0.65);
        }
      }

      const distance = 3.6;
      const height = 2.3;
      const targetCamX = targetPos[0] - Math.sin(camAngle) * distance;
      const targetCamZ = targetPos[2] - Math.cos(camAngle) * distance;
      const targetCamY = targetPos[1] + height;

      camera.position.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), 0.08);
      camera.lookAt(
        new THREE.Vector3(
          targetPos[0] + Math.sin(heading) * 1.2,
          targetPos[1] + 0.65,
          targetPos[2] + Math.cos(heading) * 1.2
        )
      );
    } else if (mode === 'duo' && leaderPos) {
      const midX = (targetPos[0] + leaderPos[0]) / 2;
      const midZ = (targetPos[2] + leaderPos[2]) / 2;
      const sep = Math.hypot(leaderPos[0] - targetPos[0], leaderPos[2] - targetPos[2]);

      const axisX = leaderPos[0] - targetPos[0];
      const axisZ = leaderPos[2] - targetPos[2];
      const axisLen = Math.hypot(axisX, axisZ) || 1;
      const perpX = -axisZ / axisLen;
      const perpZ = axisX / axisLen;

      const dist = Math.max(4.2, sep * 1.5 + 2.0);
      const camH = Math.max(2.4, sep * 0.6 + 1.8);

      camera.position.lerp(new THREE.Vector3(midX + perpX * dist, camH, midZ + perpZ * dist), 0.08);
      camera.lookAt(new THREE.Vector3(midX, 0.6, midZ));
    } else if (mode === 'overhead') {
      camera.position.lerp(new THREE.Vector3(targetPos[0], 13.0, targetPos[2] + 0.001), 0.1);
      camera.lookAt(new THREE.Vector3(targetPos[0], 0, targetPos[2]));
    }
  });

  return mode === 'orbit' ? <OrbitControls ref={controlsRef} makeDefault target={[0, 0, 0]} /> : null;
}