// Path: /Users/johann/MyBrew/funnel-real/src/arena/spawn-shield-cubes.ts

import type { World } from '@dimforge/rapier3d-simd-compat';
import { FUNNEL_DIMENSIONS } from '../config/game-config';
import { type FactionTeam } from '../combat/teams';
import type { ArenaStaticInstances } from './arena-static-instances';
import {
  addFixedEnvironmentCube,
  ENVIRONMENT_CUBE_HALF_M,
  ENVIRONMENT_CUBE_SIZE_M
} from './environment-cube';
import type { FunnelZoneId } from './funnel-zones';


export const SPAWN_SHIELD_CUBE_SIZE_M = ENVIRONMENT_CUBE_SIZE_M;

const SPAWN_SHIELD_HALF_M = ENVIRONMENT_CUBE_HALF_M;


export const SPAWN_SHIELD_ROW_COUNT = 5;
const SPAWN_SHIELD_ROW_GAP_M = ENVIRONMENT_CUBE_SIZE_M;

export type SpawnShieldRowId = 'front' | 'rear';


export const SPAWN_SHIELD_ROW_Z: Record<FactionTeam, Record<SpawnShieldRowId, number>> = {
  alpha: { front: -122.5, rear: -132.5 },
  beta: { front: 122.5, rear: 132.5 }
};


interface SpawnShieldCubeSlot {
  readonly row: SpawnShieldRowId;
  readonly index: number;
  readonly x: number;
  readonly z: number;
}


function spawnShieldRowCentersX(row: SpawnShieldRowId): readonly number[] {
  const halfW = FUNNEL_DIMENSIONS.width * 0.5;
  const lateralStep = ENVIRONMENT_CUBE_SIZE_M + SPAWN_SHIELD_ROW_GAP_M;
  const firstFrontCenter = -halfW + SPAWN_SHIELD_HALF_M;
  const firstCenter = row === 'front' ? firstFrontCenter : firstFrontCenter + lateralStep * 0.5;

  return Array.from({ length: SPAWN_SHIELD_ROW_COUNT }, (_, index) => firstCenter + index * lateralStep);
}

function spawnShieldRowZ(faction: FactionTeam, row: SpawnShieldRowId): number {
  return SPAWN_SHIELD_ROW_Z[faction][row];
}


export function teamSpawnShieldRowZ(faction: FactionTeam, row: SpawnShieldRowId): number {
  return spawnShieldRowZ(faction, row);
}

function spawnShieldSlots(faction: FactionTeam): readonly SpawnShieldCubeSlot[] {
  const rows: readonly SpawnShieldRowId[] = ['front', 'rear'];
  return rows.flatMap((row) =>
    spawnShieldRowCentersX(row).map((x, index) => ({
      row,
      index,
      x,
      z: spawnShieldRowZ(faction, row)
    }))
  );
}

function factionZoneId(faction: FactionTeam): Extract<FunnelZoneId, 'alpha' | 'beta'> {
  return faction;
}

function addSpawnShieldCube(
  instances: ArenaStaticInstances,
  world: World,
  faction: FactionTeam,
  slot: SpawnShieldCubeSlot
): void {
  addFixedEnvironmentCube(instances, world, slot.x, slot.z, factionZoneId(faction));
}


export function createSpawnShieldCubes(instances: ArenaStaticInstances, world: World): void {
  for (const slot of spawnShieldSlots('alpha')) {
    addSpawnShieldCube(instances, world, 'alpha', slot);
  }
  for (const slot of spawnShieldSlots('beta')) {
    addSpawnShieldCube(instances, world, 'beta', slot);
  }
}


export function teamBulkheadZ(faction: FactionTeam): number {
  const halfLength = FUNNEL_DIMENSIONS.length * 0.5;
  return faction === 'alpha' ? -halfLength : halfLength;
}

/** Mixamo bind pose faces +Z; beta bulkhead sits at +Z and must flip toward center. */
export function yawTowardFunnelCenter(faction: FactionTeam): number {
  return teamBulkheadZ(faction) > 0 ? Math.PI : 0;
}


export function teamSpawnPocketExtentZ(faction: FactionTeam): { minZ: number; maxZ: number } {
  const bulkheadZ = teamBulkheadZ(faction);
  const rearRowZ = spawnShieldRowZ(faction, 'rear');
  const towardBulkhead = Math.sign(bulkheadZ - rearRowZ);
  const rearFaceZ = rearRowZ + towardBulkhead * SPAWN_SHIELD_HALF_M;

  return {
    minZ: Math.min(bulkheadZ, rearFaceZ),
    maxZ: Math.max(bulkheadZ, rearFaceZ)
  };
}


export const TEAM_SPAWN_POCKET_DEPTH_M =
  teamSpawnPocketExtentZ('alpha').maxZ - teamSpawnPocketExtentZ('alpha').minZ;


export const MATCH_START_DROP_DEPTH_M = 15;
const MATCH_START_DROP_OFFSET_FROM_BULKHEAD_M = 30;


export function teamMatchStartDropExtentZ(faction: FactionTeam): { minZ: number; maxZ: number } {
  const bulkheadZ = teamBulkheadZ(faction);
  const towardCenter = -Math.sign(bulkheadZ);
  const innerZ = bulkheadZ + towardCenter * MATCH_START_DROP_OFFSET_FROM_BULKHEAD_M;
  const outerZ = bulkheadZ + towardCenter * (MATCH_START_DROP_OFFSET_FROM_BULKHEAD_M + MATCH_START_DROP_DEPTH_M);

  return {
    minZ: Math.min(innerZ, outerZ),
    maxZ: Math.max(innerZ, outerZ)
  };
}

export function teamSpawnPocketCenterZ(faction: FactionTeam): number {
  const { minZ, maxZ } = teamSpawnPocketExtentZ(faction);
  return (minZ + maxZ) * 0.5;
}


export function spawnPocketZ(faction: FactionTeam, index: number, count: number): number {
  const { minZ, maxZ } = teamSpawnPocketExtentZ(faction);
  const step = (maxZ - minZ) / (count + 1);
  return minZ + step * (index + 1);
}


export function matchStartDropZ(faction: FactionTeam, index: number, count: number): number {
  const { minZ, maxZ } = teamMatchStartDropExtentZ(faction);
  const step = (maxZ - minZ) / (count + 1);
  return minZ + step * (index + 1);
}


export function matchStartDropX(index: number): number {
  const gaps = spawnShieldGapCentersX('front');
  if (gaps.length === 0) {
    return 0;
  }

  return gaps[index % gaps.length] ?? 0;
}


export function spawnShieldGapCentersX(row: SpawnShieldRowId): readonly number[] {
  const centers = spawnShieldRowCentersX(row);
  const gaps: number[] = [];

  for (let index = 0; index < centers.length - 1; index += 1) {
    gaps.push((centers[index] + centers[index + 1]) * 0.5);
  }

  return gaps;
}


export function nearestSpawnShieldGapX(row: SpawnShieldRowId, botX: number): number {
  const gaps = spawnShieldGapCentersX(row);
  let nearestGap = gaps[0] ?? 0;
  let nearestDist = Infinity;

  for (const gap of gaps) {
    const dist = Math.abs(gap - botX);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestGap = gap;
    }
  }

  return nearestGap;
}
