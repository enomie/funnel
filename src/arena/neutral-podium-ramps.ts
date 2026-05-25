// Path: /Users/johann/MyBrew/funnel-real/src/arena/neutral-podium-ramps.ts

import type { World } from '@dimforge/rapier3d-simd-compat';
import type { ArenaStaticInstances } from './arena-static-instances';
import { addFixedEnvironmentRamp } from './environment-cube';
import {
  NEUTRAL_PODIUM_BASE_HALF_M,
  NEUTRAL_PODIUM_TOP_SIZE_M
} from './neutral-podium';

const NEUTRAL_PODIUM_TOP_HALF_M = NEUTRAL_PODIUM_TOP_SIZE_M * 0.5;
const NEUTRAL_PODIUM_STEP_HEIGHT_M = 1;


export const NEUTRAL_PODIUM_RAMP_WIDTH_M = 5;
export const NEUTRAL_PODIUM_RAMP_DEPTH_M = 5;
export const NEUTRAL_PODIUM_RAMP_HEIGHT_M = NEUTRAL_PODIUM_STEP_HEIGHT_M;

const LOWER_RAMP_CENTER_Y = NEUTRAL_PODIUM_RAMP_HEIGHT_M * 0.5;
const UPPER_RAMP_CENTER_Y = NEUTRAL_PODIUM_STEP_HEIGHT_M + NEUTRAL_PODIUM_RAMP_HEIGHT_M * 0.5;

interface NeutralPodiumRampSlot {
  readonly x: number;
  readonly z: number;
  readonly rotationY: number;
  readonly tier: 'lower' | 'upper';
}

function neutralPodiumRampSlots(): readonly NeutralPodiumRampSlot[] {
  const lowerOffset = NEUTRAL_PODIUM_BASE_HALF_M + NEUTRAL_PODIUM_RAMP_DEPTH_M * 0.5;
  const upperOffset = NEUTRAL_PODIUM_TOP_HALF_M + NEUTRAL_PODIUM_RAMP_DEPTH_M * 0.5;

  return [
    { x: 0, z: lowerOffset, rotationY: 0, tier: 'lower' },
    { x: 0, z: upperOffset, rotationY: 0, tier: 'upper' },
    { x: 0, z: -lowerOffset, rotationY: Math.PI, tier: 'lower' },
    { x: 0, z: -upperOffset, rotationY: Math.PI, tier: 'upper' }
  ];
}


export function createNeutralPodiumRamps(instances: ArenaStaticInstances, world: World): void {
  const rampSize: [number, number, number] = [
    NEUTRAL_PODIUM_RAMP_WIDTH_M,
    NEUTRAL_PODIUM_RAMP_HEIGHT_M,
    NEUTRAL_PODIUM_RAMP_DEPTH_M
  ];

  for (const slot of neutralPodiumRampSlots()) {
    const centerY = slot.tier === 'lower' ? LOWER_RAMP_CENTER_Y : UPPER_RAMP_CENTER_Y;
    addFixedEnvironmentRamp(
      instances,
      world,
      [slot.x, centerY, slot.z],
      rampSize,
      'neutral',
      slot.rotationY
    );
  }
}
