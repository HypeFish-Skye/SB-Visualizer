import * as THREE from 'three';
import { BRAND } from '../theme/brand';
import { Vec3Tuple } from '../types/mocap';

export function computeHeading(current?: Vec3Tuple, next?: Vec3Tuple): number {
  if (!current || !next) return 0;
  const dx = next[0] - current[0];
  const dz = next[2] - current[2];
  return Math.atan2(dx, dz);
}

export function getHeatmapColor(val: number, minVal: number, maxVal: number): [number, number, number] {
  const norm = Math.min(Math.max((val - minVal) / (maxVal - minVal || 1), 0), 1);
  const c1 = new THREE.Color(BRAND.cerulean[400]);
  const c2 = new THREE.Color(BRAND.orange[500]);
  c1.lerp(c2, norm);
  return [c1.r, c1.g, c1.b];
}