// Path: /Users/johann/MyBrew/funnel-real/src/render/pickup-geometries.ts

import { BoxGeometry, BufferGeometry } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PICKUP_FIELD_CONFIG } from '../config/game-config';

const CROSS_SURFACE_EPSILON_M = 0.003;

let healthCrossGeometry: BufferGeometry | null = null;

function appendCrossFace(
  parts: BufferGeometry[],
  armLength: number,
  barThickness: number,
  centerY: number
): void {
  const horizontalBar = new BoxGeometry(armLength, barThickness, barThickness);
  horizontalBar.translate(0, centerY, 0);
  parts.push(horizontalBar);

  const verticalBar = new BoxGeometry(barThickness, barThickness, armLength);
  verticalBar.translate(0, centerY, 0);
  parts.push(verticalBar);
}

export function getHealthCrossGeometry(): BufferGeometry {
  if (healthCrossGeometry !== null) {
    return healthCrossGeometry;
  }

  const [width, height, depth] = PICKUP_FIELD_CONFIG.health.size;
  const armLength = Math.min(width, depth) * PICKUP_FIELD_CONFIG.health.crossArmFraction;
  const barThickness = PICKUP_FIELD_CONFIG.health.crossBarThicknessM;
  const halfHeight = height * 0.5;
  const faceOffset = barThickness * 0.5 + CROSS_SURFACE_EPSILON_M;
  const topCenterY = halfHeight + faceOffset;
  const bottomCenterY = -topCenterY;

  const parts: BufferGeometry[] = [];
  appendCrossFace(parts, armLength, barThickness, topCenterY);
  appendCrossFace(parts, armLength, barThickness, bottomCenterY);

  healthCrossGeometry = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }

  return healthCrossGeometry;
}
