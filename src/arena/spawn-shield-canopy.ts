// Path: /Users/johann/MyBrew/funnel-real/src/arena/spawn-shield-canopy.ts

import type { World } from '@dimforge/rapier3d-simd-compat';
import { FUNNEL_DIMENSIONS } from '../config/game-config';
import type { FactionTeam } from '../combat/teams';
import type { ArenaStaticInstances } from './arena-static-instances';
import { addFixedEnvironmentBox, ENVIRONMENT_CUBE_HALF_M, ENVIRONMENT_CUBE_SIZE_M } from './environment-cube';
import { SPAWN_SHIELD_ROW_Z, teamBulkheadZ } from './spawn-shield-cubes';


export const SPAWN_SHIELD_CANOPY_SIZE_M = {
  width: FUNNEL_DIMENSIONS.width,
  height: FUNNEL_DIMENSIONS.height - ENVIRONMENT_CUBE_SIZE_M,
  length: 30
} as const;

const CANOPY_BASE_Y_M = ENVIRONMENT_CUBE_SIZE_M;
const CANOPY_CENTER_Y_M = CANOPY_BASE_Y_M + SPAWN_SHIELD_CANOPY_SIZE_M.height * 0.5;


export function spawnShieldCanopyExtentZ(faction: FactionTeam): { minZ: number; maxZ: number } {
  const bulkheadZ = teamBulkheadZ(faction);
  const frontRowZ = SPAWN_SHIELD_ROW_Z[faction].front;
  const towardNeutral = -Math.sign(bulkheadZ);
  const frontFaceZ = frontRowZ + towardNeutral * ENVIRONMENT_CUBE_HALF_M;

  return {
    minZ: Math.min(bulkheadZ, frontFaceZ),
    maxZ: Math.max(bulkheadZ, frontFaceZ)
  };
}

function spawnShieldCanopyCenter(faction: FactionTeam): [number, number, number] {
  const { minZ, maxZ } = spawnShieldCanopyExtentZ(faction);
  return [0, CANOPY_CENTER_Y_M, (minZ + maxZ) * 0.5];
}


export function createSpawnShieldCanopies(instances: ArenaStaticInstances, world: World): void {
  const size: [number, number, number] = [
    SPAWN_SHIELD_CANOPY_SIZE_M.width,
    SPAWN_SHIELD_CANOPY_SIZE_M.height,
    SPAWN_SHIELD_CANOPY_SIZE_M.length
  ];

  for (const faction of ['alpha', 'beta'] as const) {
    addFixedEnvironmentBox(instances, world, spawnShieldCanopyCenter(faction), size, faction);
  }
}
