// Path: /Users/johann/MyBrew/funnel-real/src/arena/side-wall-ceiling-ramps.ts

import type { World } from '@dimforge/rapier3d-simd-compat';
import {
  FUNNEL_DIMENSIONS,
  FUNNEL_ZONE_COUNT,
  FUNNEL_ZONE_LENGTH_M,
  funnelZoneExtentZ
} from '../config/game-config';
import type { ArenaStaticInstances } from './arena-static-instances';
import { addFixedEnvironmentRamp } from './environment-cube';
import type { FunnelZoneId } from './funnel-zones';

const SIDE_WALL_RAMP_HEIGHT_M = 5;
const SIDE_WALL_RAMP_DEPTH_M = 5;
const CEILING_RAMP_ROTATION_X = Math.PI;

const ZONE_ORDER: readonly FunnelZoneId[] = ['alpha', 'neutral', 'beta'];

interface SideWallCeilingRampSlot {
  readonly zoneId: FunnelZoneId;
  readonly x: number;
  readonly z: number;
  readonly rotationY: number;
}


function sideWallCeilingRampSlots(): readonly SideWallCeilingRampSlot[] {
  const halfWidth = FUNNEL_DIMENSIONS.width * 0.5;
  const halfDepth = SIDE_WALL_RAMP_DEPTH_M * 0.5;
  const xLeft = -halfWidth + halfDepth;
  const xRight = halfWidth - halfDepth;
  const slots: SideWallCeilingRampSlot[] = [];

  for (let zoneIndex = 0; zoneIndex < FUNNEL_ZONE_COUNT; zoneIndex += 1) {
    const zoneId = ZONE_ORDER[zoneIndex] ?? 'neutral';
    const { minZ, maxZ } = funnelZoneExtentZ(zoneIndex);
    const centerZ = (minZ + maxZ) * 0.5;

    slots.push(
      { zoneId, x: xLeft, z: centerZ, rotationY: Math.PI * 0.5 },
      { zoneId, x: xRight, z: centerZ, rotationY: -Math.PI * 0.5 }
    );
  }

  return slots;
}


export function createSideWallCeilingRamps(instances: ArenaStaticInstances, world: World): void {
  const centerY = FUNNEL_DIMENSIONS.height - SIDE_WALL_RAMP_HEIGHT_M * 0.5;
  const rampSize: [number, number, number] = [
    FUNNEL_ZONE_LENGTH_M,
    SIDE_WALL_RAMP_HEIGHT_M,
    SIDE_WALL_RAMP_DEPTH_M
  ];

  for (const slot of sideWallCeilingRampSlots()) {
    addFixedEnvironmentRamp(
      instances,
      world,
      [slot.x, centerY, slot.z],
      rampSize,
      slot.zoneId,
      slot.rotationY,
      CEILING_RAMP_ROTATION_X
    );
  }
}
