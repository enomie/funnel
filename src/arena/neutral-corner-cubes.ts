import type { World } from '@dimforge/rapier3d-simd-compat';
import { FUNNEL_DIMENSIONS, funnelZoneExtentZ } from '../config/game-config';
import type { ArenaStaticInstances } from './arena-static-instances';
import { addFixedEnvironmentCube, ENVIRONMENT_CUBE_HALF_M } from './environment-cube';

type NeutralCornerId = 'north-west' | 'north-east' | 'south-west' | 'south-east';

interface NeutralCornerSlot {
  readonly id: NeutralCornerId;
  readonly x: number;
  readonly z: number;
}

/** 5 m cubes flush to side walls and neutral zone Z bounds (5 m grid aligned). */
function neutralCornerSlots(): readonly NeutralCornerSlot[] {
  const halfW = FUNNEL_DIMENSIONS.width * 0.5;
  const { minZ, maxZ } = funnelZoneExtentZ(1);
  const h = ENVIRONMENT_CUBE_HALF_M;
  const xLeft = -halfW + h;
  const xRight = halfW - h;
  const zNorth = minZ + h;
  const zSouth = maxZ - h;

  return [
    { id: 'north-west', x: xLeft, z: zNorth },
    { id: 'north-east', x: xRight, z: zNorth },
    { id: 'south-west', x: xLeft, z: zSouth },
    { id: 'south-east', x: xRight, z: zSouth }
  ];
}

/** Four fixed 5³ m corner pillars in the neutral zone — docs/environment.md. */
export function createNeutralCornerCubes(instances: ArenaStaticInstances, world: World): void {
  for (const slot of neutralCornerSlots()) {
    addFixedEnvironmentCube(instances, world, slot.x, slot.z, 'neutral');
  }
}
