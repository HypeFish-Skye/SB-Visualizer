import { useMemo, useEffect, useState } from 'react';
import { useLoader, useFrame } from '@react-three/fiber';
import { FBXLoader } from 'three-stdlib';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';
import { BRAND } from '../../theme/brand.js';
import { Vec3Tuple } from '../../types/types.js';
import { computeHeading } from '../../utils/mocapMath.js';

interface HumanFbxMeshProps {
  position?: Vec3Tuple;
  nextPosition?: Vec3Tuple;
  trajectory?: Vec3Tuple[];
  currentFrame?: number;
  speed?: number;
  scale?: number;
  rotationOffset?: number;
  ringColor?: string;
}

/**
 * Strips horizontal translation (X and Z) from the root bone so the walk
 * cycle stays in-place while keeping natural vertical hip bounce.
 */
function makeClipInPlace(clip: THREE.AnimationClip): THREE.AnimationClip {
  const cloned = clip.clone();
  cloned.tracks.forEach((track) => {
    if (track.name.toLowerCase().endsWith('.position')) {
      for (let i = 0; i < track.values.length; i += 3) {
        track.values[i] = 0;     // Lock horizontal X
        track.values[i + 2] = 0; // Lock horizontal Z
      }
    }
  });
  return cloned;
}

export function HumanFbxMesh({
  position,
  nextPosition,
  trajectory,
  currentFrame = 0,
  speed = 0,
  scale = 1.0,
  rotationOffset = 0,
  ringColor = BRAND.beige[100],
}: HumanFbxMeshProps) {
  const idleFbx = useLoader(FBXLoader, 'models/Idle.fbx');
  const walkFbx = useLoader(FBXLoader, 'models/Standard Walk.fbx');

  const [hasMesh, setHasMesh] = useState(true);

  // 1. Calculate the exact frame where the leader physically starts moving
  const motionOnsetFrame = useMemo(() => {
    if (!trajectory || trajectory.length < 2) return 0;
    const [startX, , startZ] = trajectory[0];

    // Find the first frame where total displacement exceeds 15 cm
    let reachedThreshold = -1;
    for (let i = 0; i < trajectory.length; i++) {
      const [x, , z] = trajectory[i];
      if (Math.hypot(x - startX, z - startZ) > 0.15) {
        reachedThreshold = i;
        break;
      }
    }
    if (reachedThreshold === -1) return Infinity; // Subject never moves in this trial

    // Step backwards to find when they first broke past baseline standing sway (3.5 cm)
    for (let j = reachedThreshold; j >= 0; j--) {
      const [jx, , jz] = trajectory[j];
      if (Math.hypot(jx - startX, jz - startZ) <= 0.035) {
        return j + 1;
      }
    }
    return 0;
  }, [trajectory]);

  // 2. Physical displacement speed (m/s at 60 fps)
  const physicalSpeed = useMemo(() => {
    if (!position || !nextPosition) return 0;
    const dx = nextPosition[0] - position[0];
    const dz = nextPosition[2] - position[2];
    return Math.hypot(dx, dz) * 60;
  }, [position, nextPosition]);

  // 3. Motion state gate:
  // - MUST be at or past motionOnsetFrame (blocks any start-of-recording velocity artifacts)
  // - AND must have active physical displacement / speed
  const hasBegunWalking = currentFrame >= motionOnsetFrame;
  const isMoving = hasBegunWalking && (speed > 0.15 || physicalSpeed > 0.10);

  // 4. Model instantiation & material normalization
  const { model, mixer, skeletonHelper } = useMemo(() => {
    if (!idleFbx) return { model: null, mixer: null, skeletonHelper: null };

    const clone = SkeletonUtils.clone(idleFbx) as THREE.Group;

    let meshCount = 0;
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        meshCount++;
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        mesh.material = new THREE.MeshStandardMaterial({
          color: '#cbd5e1',
          roughness: 0.5,
          metalness: 0.1,
          side: THREE.DoubleSide,
        });
      }
    });

    setHasMesh(meshCount > 0);

    const fbxScale = 0.01 * scale;
    clone.scale.set(fbxScale, fbxScale, fbxScale);

    const animMixer = new THREE.AnimationMixer(clone);

    let helper: THREE.SkeletonHelper | null = null;
    if (meshCount === 0) {
      helper = new THREE.SkeletonHelper(clone);
      (helper.material as THREE.LineBasicMaterial).linewidth = 3;
      (helper.material as THREE.LineBasicMaterial).color = new THREE.Color(BRAND.cerulean[400]);
    }

    return { model: clone, mixer: animMixer, skeletonHelper: helper };
  }, [idleFbx, scale]);

  // 5. Setup animation actions
  const actions = useMemo(() => {
    if (!mixer || !idleFbx?.animations.length) return null;

    const idleClip = idleFbx.animations[0];
    const idleAction = mixer.clipAction(idleClip);
    idleAction.play();

    let walkAction: THREE.AnimationAction | null = null;
    if (walkFbx?.animations.length) {
      const inPlaceWalk = makeClipInPlace(walkFbx.animations[0]);
      walkAction = mixer.clipAction(inPlaceWalk);
    }

    return { idle: idleAction, walk: walkAction };
  }, [mixer, idleFbx, walkFbx]);

  // Step mixer clock
  useFrame((_, delta) => {
    if (mixer) mixer.update(delta);
    if (skeletonHelper) skeletonHelper.update();
  });

  // 6. Crossfade between Idle and Walk
  useEffect(() => {
    if (!actions) return;
    const { idle, walk } = actions;

    if (isMoving && walk) {
      idle.fadeOut(0.25);
      walk.reset().fadeIn(0.25).play();
    } else {
      if (walk) walk.fadeOut(0.25);
      idle.reset().fadeIn(0.25).play();
    }
  }, [isMoving, actions]);

  // 7. Synchronize walk stride cadence to actual velocity
  useEffect(() => {
    if (actions?.walk && isMoving) {
      const activeSpeed = Math.max(physicalSpeed, speed);
      const timeScale = Math.max(0.6, Math.min(2.0, (activeSpeed || 1.0) / 1.15));
      actions.walk.setEffectiveTimeScale(timeScale);
    }
  }, [speed, physicalSpeed, isMoving, actions]);

  // Cleanup
  useEffect(() => {
    return () => {
      mixer?.stopAllAction();
    };
  }, [mixer]);

  if (!position || !model) return null;

  const heading = computeHeading(position, nextPosition);

  return (
    <group position={position} rotation={[0, heading + rotationOffset, 0]}>
      {/* Ground foot indicator ring */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.25, 32]} />
        <meshBasicMaterial color={ringColor} transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>

      {/* 3D Skinned Mesh */}
      <primitive object={model} />

      {/* Wireframe skeleton helper fallback */}
      {!hasMesh && skeletonHelper && <primitive object={skeletonHelper} />}
    </group>
  );
}