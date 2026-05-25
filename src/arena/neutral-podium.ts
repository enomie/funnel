// Path: /Users/johann/MyBrew/funnel-real/src/arena/neutral-podium.ts

import type { World } from '@dimforge/rapier3d-simd-compat';
import type { ArenaStaticInstances } from './arena-static-instances';
import { addFixedEnvironmentBox } from './environment-cube';


const GRID_MODULE_M = 5;


export const NEUTRAL_PODIUM_BASE_SIZE_M = GRID_MODULE_M * 4;

export const NEUTRAL_PODIUM_TOP_SIZE_M = GRID_MODULE_M * 2;


export const NEUTRAL_PODIUM_BASE_HALF_M = NEUTRAL_PODIUM_BASE_SIZE_M * 0.5;


export const NEUTRAL_PODIUM_DETOUR_PAD_M = 2.5;

const PODIUM_STEP_HEIGHT_M = 1;

const PODIUM_BASE_HALF_HEIGHT = PODIUM_STEP_HEIGHT_M * 0.5;
const PODIUM_TOP_CENTER_Y = PODIUM_STEP_HEIGHT_M + PODIUM_BASE_HALF_HEIGHT;


export const REDEEMER_SPAWN_CENTER_Y = PODIUM_STEP_HEIGHT_M * 2 + 0.35;


export const REDEEMER_SPAWN_POSITION = {
  x: 0,
  y: REDEEMER_SPAWN_CENTER_Y,
  z: 0
} as const;


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
