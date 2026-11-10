import React, { useMemo } from 'react';
import * as THREE from 'three';

interface PhysicalPropMeshProps {
  position?: [number, number, number];
  nextPosition?: [number, number, number];
  trajectory?: [number, number, number][];
  markers?: Record<string, [number, number, number][]>;
  currentFrame: number;
}

export const PhysicalPropMesh: React.FC<PhysicalPropMeshProps> = ({
  position,
  nextPosition,
  trajectory = [],
  markers,
  currentFrame,
}) => {
  const activePos = position || trajectory[Math.min(currentFrame, Math.max(0, trajectory.length - 1))];
  const hasValidPos = activePos && (activePos[0] !== 0 || activePos[2] !== 0);

  const heading = useMemo(() => {
    if (!activePos) return 0;
    const next = nextPosition || trajectory[Math.min(currentFrame + 1, Math.max(0, trajectory.length - 1))];
    if (!next) return 0;
    const dx = next[0] - activePos[0];
    const dz = next[2] - activePos[2];
    return Math.hypot(dx, dz) > 0.005 ? Math.atan2(dx, dz) : 0;
  }, [activePos, nextPosition, trajectory, currentFrame]);

  // Calculate static physical dimensions of the chassis ONCE
  const { width, height, depth } = useMemo(() => {
    if (!markers || Object.keys(markers).length === 0) {
      return { width: 0.60, height: 0.65, depth: 0.48 };
    }
    
    const streams = Object.values(markers);
    if (streams.length === 0 || streams[0].length === 0) {
      return { width: 0.60, height: 0.65, depth: 0.48 };
    }
    
    let refFrame = -1;
    let refHeading = 0;
    let cx1 = 0, cz1 = 0;
    
    for (let i = 0; i < streams[0].length - 10; i += 5) {
       const p1s = streams.filter(s => s[i] && (s[i][0] !== 0 || s[i][2] !== 0));
       const p2s = streams.filter(s => s[i+10] && (s[i+10][0] !== 0 || s[i+10][2] !== 0));
       
       if (p1s.length >= 2 && p2s.length >= 2) {
           const cxA = p1s.reduce((sum, p) => sum + p[i][0], 0) / p1s.length;
           const czA = p1s.reduce((sum, p) => sum + p[i][2], 0) / p1s.length;
           const cxB = p2s.reduce((sum, p) => sum + p[i+10][0], 0) / p2s.length;
           const czB = p2s.reduce((sum, p) => sum + p[i+10][2], 0) / p2s.length;
           
           const dist = Math.hypot(cxB - cxA, czB - czA);
           if (dist > 0.05) { 
               refFrame = i;
               refHeading = Math.atan2(cxB - cxA, czB - czA);
               cx1 = cxA; 
               cz1 = czA;
               break;
           }
       }
    }
    
    if (refFrame === -1) {
        for (let i = 0; i < streams[0].length; i++) {
           const p1s = streams.filter(s => s[i] && (s[i][0] !== 0 || s[i][2] !== 0));
           if (p1s.length >= 2) {
               refFrame = i;
               cx1 = p1s.reduce((sum, p) => sum + p[i][0], 0) / p1s.length;
               cz1 = p1s.reduce((sum, p) => sum + p[i][2], 0) / p1s.length;
               break;
           }
        }
    }
    
    if (refFrame === -1) return { width: 0.60, height: 0.65, depth: 0.48 };

    const cos = Math.cos(-refHeading);
    const sin = Math.sin(-refHeading);

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    streams.forEach(s => {
       const p = s[refFrame];
       if (p && (p[0] !== 0 || p[2] !== 0)) {
          const dx = p[0] - cx1;
          const dz = p[2] - cz1;
          const locX = dx * cos - dz * sin;
          const locZ = dx * sin + dz * cos;
          if (locX < minX) minX = locX;
          if (locX > maxX) maxX = locX;
          if (p[1] < minY) minY = p[1];
          if (p[1] > maxY) maxY = p[1];
          if (locZ < minZ) minZ = locZ;
          if (locZ > maxZ) maxZ = locZ;
       }
    });

    // Enforce a minimum sensible height (e.g. 0.5m) so flat obstacles render as 3D boxes
    const calcH = Math.abs(maxY - minY);
    return {
       width: Math.max(Math.abs(maxX - minX) + 0.04, 0.15),
       height: Math.max(calcH > 0.01 ? calcH + 0.04 : 0.65, 0.50), // Enforce minimum height here
       depth: Math.max(Math.abs(maxZ - minZ) + 0.04, 0.15)
    };
  }, [markers]);

  // Calculate dynamic position and heading based PURELY on markers
  const { cx, cy, cz, currentHeading, isValid } = useMemo(() => {
    let cx = 0, cy = 0, cz = 0;
    let heading = 0;
    
    if (markers && Object.keys(markers).length > 0) {
      const streams = Object.values(markers);
      const validStreams = streams.filter(s => s[currentFrame] && (s[currentFrame][0] !== 0 || s[currentFrame][2] !== 0));
      
      if (validStreams.length > 0) {
        validStreams.forEach(s => {
          cx += s[currentFrame][0]; cy += s[currentFrame][1]; cz += s[currentFrame][2];
        });
        cx /= validStreams.length; cy /= validStreams.length; cz /= validStreams.length;
        
        for (let t = currentFrame; t >= 10; t -= 5) {
           const p1s = streams.filter(s => s[t] && (s[t][0] !== 0 || s[t][2] !== 0));
           const p2s = streams.filter(s => s[t-10] && (s[t-10][0] !== 0 || s[t-10][2] !== 0));
           if (p1s.length > 0 && p2s.length > 0) {
               const cxA = p1s.reduce((sum, s) => sum + s[t][0], 0) / p1s.length;
               const czA = p1s.reduce((sum, s) => sum + s[t][2], 0) / p1s.length;
               const cxB = p2s.reduce((sum, s) => sum + s[t-10][0], 0) / p2s.length;
               const czB = p2s.reduce((sum, s) => sum + s[t-10][2], 0) / p2s.length;
               
               const dx = cxA - cxB;
               const dz = czA - czB;
               if (Math.hypot(dx, dz) > 0.005) {
                   heading = Math.atan2(dx, dz);
                   break;
               }
           }
        }
        
        // If Y is flat (0.02) from trajectory fallback, push it up by half height so box sits on ground
        if (cy < 0.1) cy = height / 2;
        
        return { cx, cy, cz, currentHeading: heading, isValid: true };
      }
    }

    const activePos = position || trajectory[Math.min(currentFrame, Math.max(0, trajectory.length - 1))];
    const next = nextPosition || trajectory[Math.min(currentFrame + 1, Math.max(0, trajectory.length - 1))];
    if (activePos && next) {
      const dx = next[0] - activePos[0];
      const dz = next[2] - activePos[2];
      if (Math.hypot(dx, dz) > 0.005) heading = Math.atan2(dx, dz);
    }
    
    if (activePos && (activePos[0] !== 0 || activePos[2] !== 0)) {
       return { 
         cx: activePos[0], 
         cy: Math.max(activePos[1], height / 2), 
         cz: activePos[2], 
         currentHeading: heading,
         isValid: true
       };
    }
    
    return { cx: 0, cy: 0, cz: 0, currentHeading: 0, isValid: false };
  }, [markers, currentFrame, position, nextPosition, trajectory, height]);

  if (!isValid) return null;

  return (
    <group name="PhysicalProp">
      {/* 1. Optical Tracking Marker Spheres */}
      {markers &&
        Object.entries(markers).map(([name, stream]) => {
          const pt = stream[Math.min(currentFrame, stream.length - 1)];
          if (!pt || (pt[0] === 0 && pt[1] === 0 && pt[2] === 0)) return null;
          return (
            <mesh key={`prop-marker-${name}`} position={pt}>
              <sphereGeometry args={[0.018, 16, 16]} />
              <meshBasicMaterial color="#f59e0b" />
            </mesh>
          );
        })}

      {/* 2. Perfectly centered Wireframe Chassis */}
      <group position={[cx, cy, cz]} rotation={[0, currentHeading, 0]}>
        <mesh>
          <boxGeometry args={[width, height, depth]} />
          <meshBasicMaterial color="#38bdf8" wireframe={true} transparent opacity={0.4} />
        </mesh>
        
        {/* Visual Front Indicator (Solid bar at the forward Z edge) */}
        <mesh position={[0, height / 2, depth / 2]}>
          <boxGeometry args={[width * 0.6, 0.03, 0.03]} />
          <meshBasicMaterial color="#0ea5e9" />
        </mesh>
      </group>
    </group>
  );
};