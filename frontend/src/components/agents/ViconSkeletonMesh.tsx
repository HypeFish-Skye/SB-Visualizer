import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { BRAND } from '../../theme/brand.js';
import { VICON_SKELETAL_BONES } from '../../utils/viconBones.js';


interface ViconSkeletonMeshProps {
  markers: Record<string, [number, number, number][]>;
  currentFrame: number;
  markerColor?: string;
  boneColor?: string;
}

export function ViconSkeletonMesh({
  markers,
  currentFrame,
  markerColor = '#f8fafc',
  boneColor = BRAND.cerulean[400],
}: ViconSkeletonMeshProps) {
  const lineGeometryRef = useRef<THREE.BufferGeometry>(null);

  // Collect marker names present in this trial
  const markerNames = useMemo(() => Object.keys(markers), [markers]);

  // Pre-filter valid bone pairs existing in this marker set
  const activeBones = useMemo(() => {
    return VICON_SKELETAL_BONES.filter(
      ([m1, m2]) => markers[m1] && markers[m2]
    );
  }, [markers]);

  // Allocate contiguous Float32Array for line segments (2 vertices per bone)
  const linePositions = useMemo(() => {
    return new Float32Array(activeBones.length * 2 * 3);
  }, [activeBones]);

  // Fast per-frame buffer updates
  useFrame(() => {
    if (!lineGeometryRef.current) return;

    let ptr = 0;
    for (const [m1, m2] of activeBones) {
      const p1 = markers[m1][Math.min(currentFrame, markers[m1].length - 1)];
      const p2 = markers[m2][Math.min(currentFrame, markers[m2].length - 1)];

      if (p1 && p2) {
        linePositions[ptr++] = p1[0];
        linePositions[ptr++] = p1[1];
        linePositions[ptr++] = p1[2];

        linePositions[ptr++] = p2[0];
        linePositions[ptr++] = p2[1];
        linePositions[ptr++] = p2[2];
      }
    }

    const posAttr = lineGeometryRef.current.getAttribute('position') as THREE.BufferAttribute;
    if (posAttr) {
      posAttr.copyArray(linePositions);
      posAttr.needsUpdate = true;
    }
  });

  return (
    <group name="ViconSkeletalRig">
      {/* 1. Bone Segments */}
      <lineSegments>
        <bufferGeometry ref={lineGeometryRef}>
          <bufferAttribute
            attach="attributes-position"
            args={[linePositions, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color={boneColor} linewidth={2.5} />
      </lineSegments>

      {/* 2. Optical Retro-Reflective Spheres (14mm diameter) */}
      {markerNames.map((name) => {
        const stream = markers[name];
        const pt = stream[Math.min(currentFrame, stream.length - 1)];
        if (!pt || (pt[0] === 0 && pt[1] === 0 && pt[2] === 0)) return null;

        return (
          <mesh key={name} position={pt}>
            <sphereGeometry args={[0.014, 12, 12]} />
            <meshStandardMaterial
              color={markerColor}
              emissive="#38bdf8"
              emissiveIntensity={0.6}
              roughness={0.15}
              metalness={0.85}
            />
          </mesh>
        );
      })}
    </group>
  );
}