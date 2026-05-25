// Path: /Users/johann/MyBrew/funnel-real/src/arena/environment-rain-bounds.ts

import { FUNNEL_DIMENSIONS, funnelZoneExtentZ } from '../config/game-config';
import { dynamicPropVerticalExtent, type DynamicPropSpec } from './environment-dynamic-shapes';


export const RAIN_DROP_X_MIN = -15;
export const RAIN_DROP_X_MAX = 15;


const NEUTRAL_ZONE_RAIN_INSET_M = 10;

const neutralZoneZ = funnelZoneExtentZ(1);

export const RAIN_DROP_Z_MIN = neutralZoneZ.minZ + NEUTRAL_ZONE_RAIN_INSET_M;
export const RAIN_DROP_Z_MAX = neutralZoneZ.maxZ - NEUTRAL_ZONE_RAIN_INSET_M;


export const RAIN_SPAWN_Y_MIN = 52;
export const RAIN_SPAWN_Y_MAX = 58;


export const RAIN_COUNTDOWN_SPAWN_Y_MIN = 10;
export const RAIN_COUNTDOWN_SPAWN_Y_MAX = 14;

export const FUNNEL_INTERIOR_CEILING_Y = FUNNEL_DIMENSIONS.height;

export function clampRainDropX(x: number): number {
  return Math.max(RAIN_DROP_X_MIN, Math.min(RAIN_DROP_X_MAX, x));
}

export function clampRainDropZ(z: number): number {
  return Math.max(RAIN_DROP_Z_MIN, Math.min(RAIN_DROP_Z_MAX, z));
}


export function rainSpawnY(): number {
  return (RAIN_SPAWN_Y_MIN + RAIN_SPAWN_Y_MAX) * 0.5;
}

export function randomRainDropX(): number {
  return RAIN_DROP_X_MIN + Math.random() * (RAIN_DROP_X_MAX - RAIN_DROP_X_MIN);
}

export function randomRainDropZ(): number {
  return RAIN_DROP_Z_MIN + Math.random() * (RAIN_DROP_Z_MAX - RAIN_DROP_Z_MIN);
}

export function randomRainSpawnY(): number {
  return RAIN_SPAWN_Y_MIN + Math.random() * (RAIN_SPAWN_Y_MAX - RAIN_SPAWN_Y_MIN);
}


export function randomRainDropPosition(): readonly [number, number] {
  return [randomRainDropX(), randomRainDropZ()];
}


export function randomRainSpawnCenter(): readonly [number, number, number] {
  return [randomRainDropX(), randomRainSpawnY(), randomRainDropZ()];
}


export function randomCountdownRainSpawnCenter(
  shape: DynamicPropSpec
): readonly [number, number, number] {
  const halfHeight = dynamicPropVerticalExtent(shape) * 0.5;
  return randomPickupSpawnCenter(halfHeight);
}


export function randomPickupSpawnCenter(halfExtentY: number): readonly [number, number, number] {
  const yMin = RAIN_COUNTDOWN_SPAWN_Y_MIN + halfExtentY;
  const yMax = RAIN_COUNTDOWN_SPAWN_Y_MAX + halfExtentY;
  const y = yMin + Math.random() * (yMax - yMin);
  return [randomRainDropX(), y, randomRainDropZ()];
}
