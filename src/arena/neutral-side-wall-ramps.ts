// Path: /Users/johann/MyBrew/funnel-real/src/arena/neutral-side-wall-ramps.ts

import type { World } from '@dimforge/rapier3d-simd-compat';
import { FUNNEL_DIMENSIONS } from '../config/game-config';
import type { ArenaStaticInstances } from './arena-static-instances';
import { addFixedEnvironmentRamp } from './environment-cube';


const NEUTRAL_SIDE_RAMP_LENGTH_M = 90;
const NEUTRAL_SIDE_RAMP_HEIGHT_M = 5;
const NEUTRAL_SIDE_RAMP_DEPTH_M = 5;

interface NeutralSideWallRampSlot {
  readonly x: number;
  readonly rotationY: number;
}


function neutralSideWallRampSlots(): readonly NeutralSideWallRampSlot[] {
  const halfWidth = FUNNEL_DIMENSIONS.width * 0.5;
  const halfDepth = NEUTRAL_SIDE_RAMP_DEPTH_M * 0.5;
  const xLeft = -halfWidth + halfDepth;
  const xRight = halfWidth - halfDepth;

  return [
    { x: xLeft, rotationY: Math.PI * 0.5 },
    { x: xRight, rotationY: -Math.PI * 0.5 }
  ];
}


export function createNeutralSideWallRamps(instances: ArenaStaticInstances, world: World): void {
  const centerY = NEUTRAL_SIDE_RAMP_HEIGHT_M * 0.5;
  const rampSize: [number, number, number] = [
    NEUTRAL_SIDE_RAMP_LENGTH_M,
    NEUTRAL_SIDE_RAMP_HEIGHT_M,
    NEUTRAL_SIDE_RAMP_DEPTH_M
  ];

  for (const slot of neutralSideWallRampSlots()) {
    addFixedEnvironmentRamp(
      instances,
      world,
      [slot.x, centerY, 0],
      rampSize,
      'neutral',
      slot.rotationY
    );
  }
}
