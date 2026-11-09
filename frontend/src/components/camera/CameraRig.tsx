import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { CameraMode, Vec3Tuple } from '../../types/types.js';
import { computeHeading } from '../../utils/mocapMath.js';

interface CameraRigProps {
  mode: CameraMode;
  targetPos?: Vec3Tuple;   // Robot / Follower
  nextPos?: Vec3Tuple;
  leaderPos?: Vec3Tuple;   // Primary Human
  leaderNext?: Vec3Tuple;
}

export function CameraRig({ mode, targetPos, nextPos, leaderPos, leaderNext }: CameraRigProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);

  useFrame(({ camera }) => {
    // If no follower target exists, fall back to following the leader
    const effectiveTarget = targetPos || leaderPos;
    const effectiveNext = nextPos || leaderNext || effectiveTarget;
    const hasFollower = !!targetPos;

    if (!effectiveTarget) return;

    if (mode === 'chase') {
      const heading = computeHeading(effectiveTarget, effectiveNext);
      let camAngle = heading;

      // If chasing the robot, avoid occluding the human if they walk behind
      if (hasFollower && leaderPos) {
        const dx = leaderPos[0] - effectiveTarget[0];
        const dz = leaderPos[2] - effectiveTarget[2];
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
      const targetCamX = effectiveTarget[0] - Math.sin(camAngle) * distance;
      const targetCamZ = effectiveTarget[2] - Math.cos(camAngle) * distance;
      const targetCamY = effectiveTarget[1] + height;

      camera.position.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), 0.08);
      camera.lookAt(
        new THREE.Vector3(
          effectiveTarget[0] + Math.sin(heading) * 1.2,
          effectiveTarget[1] + 0.65,
          effectiveTarget[2] + Math.cos(heading) * 1.2
        )
      );
    } else if (mode === 'duo') {
      if (hasFollower && leaderPos) {
        // Multi-agent framing: side perspective framing both robot and human
        const midX = (effectiveTarget[0] + leaderPos[0]) / 2;
        const midZ = (effectiveTarget[2] + leaderPos[2]) / 2;
        const sep = Math.hypot(leaderPos[0] - effectiveTarget[0], leaderPos[2] - effectiveTarget[2]);

        const axisX = leaderPos[0] - effectiveTarget[0];
        const axisZ = leaderPos[2] - effectiveTarget[2];
        const axisLen = Math.hypot(axisX, axisZ) || 1;
        const perpX = -axisZ / axisLen;
        const perpZ = axisX / axisLen;

        const dist = Math.max(4.2, sep * 1.5 + 2.0);
        const camH = Math.max(2.4, sep * 0.6 + 1.8);

        camera.position.lerp(new THREE.Vector3(midX + perpX * dist, camH, midZ + perpZ * dist), 0.08);
        camera.lookAt(new THREE.Vector3(midX, 0.6, midZ));
      } else {
        // Single agent (no follower): 3/4 elevated flanking tracking camera on the leader
        const heading = computeHeading(effectiveTarget, effectiveNext);
        const flankAngle = heading + 0.75; // 45° offset for side-perspective tracking
        const dist = 4.2;
        const camH = 2.3;
        const camX = effectiveTarget[0] - Math.sin(flankAngle) * dist;
        const camZ = effectiveTarget[2] - Math.cos(flankAngle) * dist;
        const camY = effectiveTarget[1] + camH;

        camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.08);
        camera.lookAt(new THREE.Vector3(effectiveTarget[0], effectiveTarget[1] + 0.8, effectiveTarget[2]));
      }
    } else if (mode === 'overhead') {
      // Top-down tracking view over the active target (leader when no follower)
      camera.position.lerp(new THREE.Vector3(effectiveTarget[0], 13.0, effectiveTarget[2] + 0.001), 0.1);
      camera.lookAt(new THREE.Vector3(effectiveTarget[0], 0, effectiveTarget[2]));
    }
  });

  return mode === 'orbit' ? <OrbitControls ref={controlsRef} makeDefault target={[0, 0, 0]} /> : null;
}