import { useState } from 'react';
import { Html, Sphere } from '@react-three/drei';
import { BRAND } from '../../theme/brand';
import { Vec3Tuple } from '../../types/mocap';

interface GhostFollowerProps {
  position?: Vec3Tuple;
  label: string;
  onClick: () => void;
}

export function GhostFollower({ position, label, onClick }: GhostFollowerProps) {
  const [hovered, setHovered] = useState(false);
  if (!position) return null;

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'auto';
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      {/* Expanded invisible hit-test geometry */}
      <mesh visible={false}>
        <sphereGeometry args={[0.35, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      <Sphere args={[hovered ? 0.18 : 0.14, 16, 16]}>
        <meshStandardMaterial
          color={hovered ? '#ffffff' : BRAND.orange[400]}
          emissive={hovered ? '#ffffff' : BRAND.orange[500]}
          emissiveIntensity={hovered ? 1.4 : 0.8}
          transparent
          opacity={0.9}
        />
      </Sphere>

      <mesh position={[0, -0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[hovered ? 0.28 : 0.18, 16]} />
        <meshBasicMaterial color={BRAND.orange[500]} transparent opacity={hovered ? 0.6 : 0.25} />
      </mesh>

      {hovered && (
        <Html position={[0, 0.45, 0]} center pointerEvents="none">
          <div
            style={{
              background: BRAND.navy[700],
              color: BRAND.orange[300],
              padding: '5px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              border: `1px solid ${BRAND.orange[500]}`,
              whiteSpace: 'nowrap',
              boxShadow: '0 6px 20px rgba(0,0,0,0.8)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: BRAND.orange[400],
              }}
            />
            Click to load: {label}
          </div>
        </Html>
      )}
    </group>
  );
}