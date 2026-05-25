import type { World } from '@dimforge/rapier3d-simd-compat';
import type { ArenaStaticInstances } from './arena-static-instances';
import { addFixedEnvironmentBox } from './environment-cube';

/** 5 m floor/major grid — centered footprints need size % 10 m (edges on ±5, ±10, …). */
const GRID_MODULE_M = 5;

/** 4×4 modules (was 15 m — misaligned ±7.5 m edges). */
export const NEUTRAL_PODIUM_BASE_SIZE_M = GRID_MODULE_M * 4;
/** 2×2 modules (was 5 m — misaligned ±2.5 m edges). */
export const NEUTRAL_PODIUM_TOP_SIZE_M = GRID_MODULE_M * 2;

/** Half-extent of the 20×20 m base footprint (world X/Z). */
export const NEUTRAL_PODIUM_BASE_HALF_M = NEUTRAL_PODIUM_BASE_SIZE_M * 0.5;

/** Route bots this far outside the base edge when detouring around center cover. */
export const NEUTRAL_PODIUM_DETOUR_PAD_M = 2.5;

const PODIUM_STEP_HEIGHT_M = 1;

const PODIUM_BASE_HALF_HEIGHT = PODIUM_STEP_HEIGHT_M * 0.5;
const PODIUM_TOP_CENTER_Y = PODIUM_STEP_HEIGHT_M + PODIUM_BASE_HALF_HEIGHT;

/** Podium top at y = 2; weapon pickup hovers ~0.35 m above it. */
export const REDEEMER_SPAWN_CENTER_Y = PODIUM_STEP_HEIGHT_M * 2 + 0.35;

/** World anchor for Redeemer weapon spawn (pickup wiring later). */
export const REDEEMER_SPAWN_POSITION = {
  x: 0,
  y: REDEEMER_SPAWN_CENTER_Y,
  z: 0
} as const;

/** Two-step neutral podium at funnel center — Redeemer pickup at `REDEEMER_SPAWN_POSITION`. */
export function createNeutralPodium(instances: ArenaStaticInstances, world: World): void {
  addFixedEnvironmentBox(
    instances,
    world,
    [0, PODIUM_BASE_HALF_HEIGHT, 0],
    [NEUTRAL_PODIUM_BASE_SIZE_M, PODIUM_STEP_HEIGHT_M, NEUTRAL_PODIUM_BASE_SIZE_M],
    'neutral'
  );

  addFixedEnvironmentBox(
    instances,
    world,
    [0, PODIUM_TOP_CENTER_Y, 0],
    [NEUTRAL_PODIUM_TOP_SIZE_M, PODIUM_STEP_HEIGHT_M, NEUTRAL_PODIUM_TOP_SIZE_M],
    'neutral'
  );
}
