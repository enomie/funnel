// Path: /Users/johann/MyBrew/funnel-real/src/arena/zone-border-ramps.ts

import type { World } from '@dimforge/rapier3d-simd-compat';
import { FUNNEL_DIMENSIONS, funnelZoneExtentZ } from '../config/game-config';
import type { ArenaStaticInstances } from './arena-static-instances';
import {
  addFixedEnvironmentRamp,
  ENVIRONMENT_RAMP_CENTER_Y,
  ENVIRONMENT_RAMP_SIZE_M
} from './environment-cube';
import type { FunnelZoneId } from './funnel-zones';

type TeamZoneId = Extract<FunnelZoneId, 'alpha' | 'beta'>;


const TEAM_ZONE_RAMP_INSET_M = 2.5;

interface ZoneBorderRampSlot {
  readonly zoneId: TeamZoneId;
  readonly x: number;
  readonly z: number;
  readonly rotationY: number;
}


function zoneBorderRampSlots(): readonly ZoneBorderRampSlot[] {
  const halfWidth = FUNNEL_DIMENSIONS.width * 0.5;
  const halfRampWidth = ENVIRONMENT_RAMP_SIZE_M * 0.5;
  const xLeft = -halfWidth + halfRampWidth;
  const xRight = halfWidth - halfRampWidth;
  const { minZ, maxZ } = funnelZoneExtentZ(1);

  return [
    { zoneId: 'alpha', x: xLeft, z: minZ - TEAM_ZONE_RAMP_INSET_M, rotationY: Math.PI },
    { zoneId: 'alpha', x: xRight, z: minZ - TEAM_ZONE_RAMP_INSET_M, rotationY: Math.PI },
    { zoneId: 'beta', x: xLeft, z: maxZ + TEAM_ZONE_RAMP_INSET_M, rotationY: 0 },
    { zoneId: 'beta', x: xRight, z: maxZ + TEAM_ZONE_RAMP_INSET_M, rotationY: 0 }
  ];
}


export function createZoneBorderRamps(instances: ArenaStaticInstances, world: World): void {
  const rampSize: [number, number, number] = [
    ENVIRONMENT_RAMP_SIZE_M,
    ENVIRONMENT_RAMP_SIZE_M,
    ENVIRONMENT_RAMP_SIZE_M
  ];

  for (const slot of zoneBorderRampSlots()) {
    addFixedEnvironmentRamp(
      instances,
      world,
      [slot.x, ENVIRONMENT_RAMP_CENTER_Y, slot.z],
      rampSize,
      slot.zoneId,
      slot.rotationY
    );
  }
}
