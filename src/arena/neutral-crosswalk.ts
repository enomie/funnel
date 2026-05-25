// Path: /Users/johann/MyBrew/funnel-real/src/arena/neutral-crosswalk.ts

import type { World } from '@dimforge/rapier3d-simd-compat';
import { FUNNEL_DIMENSIONS } from '../config/game-config';
import type { ArenaStaticInstances } from './arena-static-instances';
import { addFixedEnvironmentBox } from './environment-cube';


export const NEUTRAL_CROSSWALK_WIDTH_M = FUNNEL_DIMENSIONS.width;
export const NEUTRAL_CROSSWALK_HEIGHT_M = 2;
export const NEUTRAL_CROSSWALK_DEPTH_M = 10;

export const NEUTRAL_CROSSWALK_LIFT_M = 15;

const CROSSWALK_CENTER_Y = NEUTRAL_CROSSWALK_LIFT_M + NEUTRAL_CROSSWALK_HEIGHT_M * 0.5;


export function createNeutralCrosswalk(instances: ArenaStaticInstances, world: World): void {
  addFixedEnvironmentBox(
    instances,
    world,
    [0, CROSSWALK_CENTER_Y, 0],
    [NEUTRAL_CROSSWALK_WIDTH_M, NEUTRAL_CROSSWALK_HEIGHT_M, NEUTRAL_CROSSWALK_DEPTH_M],
    'neutral'
  );
}
