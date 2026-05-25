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

/** @deprecated Use ENVIRONMENT_CUBE_SIZE_M — kept for existing imports. */
export const SPAWN_SHIELD_CUBE_SIZE_M = ENVIRONMENT_CUBE_SIZE_M;

const SPAWN_SHIELD_HALF_M = ENVIRONMENT_CUBE_HALF_M;

/** 50 m width → 5 × 5 m cubes with 5 m gaps (wall-flush on front row). */
export const SPAWN_SHIELD_ROW_COUNT = 5;
const SPAWN_SHIELD_ROW_GAP_M = ENVIRONMENT_CUBE_SIZE_M;

export type SpawnShieldRowId = 'front' | 'rear';

/** Grid-aligned Z centers — rear row 10 m toward bulkhead (5 m cube + 5 m row gap). */
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

/**
 * Front row flush to left wall; rear row offset +5 m in X so gaps stagger.
 * Walkable 5 m slots zigzag; no straight lane for projectiles from neutral.
 */
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

/** Row Z center for a team's spawn shield line. */
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

/** Twenty fixed 5³ m spawn shields (2 staggered rows × 5 per team) — docs/environment.md. */
export function createSpawnShieldCubes(instances: ArenaStaticInstances, world: World): void {
  for (const slot of spawnShieldSlots('alpha')) {
    addSpawnShieldCube(instances, world, 'alpha', slot);
  }
  for (const slot of spawnShieldSlots('beta')) {
    addSpawnShieldCube(instances, world, 'beta', slot);
  }
}

/** World Z of team bulkhead (north alpha / south beta). */
export function teamBulkheadZ(faction: FactionTeam): number {
  const halfLength = FUNNEL_DIMENSIONS.length * 0.5;
  return faction === 'alpha' ? -halfLength : halfLength;
}

/** Z extent of the 15 m spawn pocket behind the rear shield row (bulkhead → rear block back face). */
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

/** Depth of spawn pocket behind rear shields (bulkhead − rear back face; currently 15 m). */
export const TEAM_SPAWN_POCKET_DEPTH_M =
  teamSpawnPocketExtentZ('alpha').maxZ - teamSpawnPocketExtentZ('alpha').minZ;

/** Match-start intro drop — 15 m band starting 30 m from bulkhead (docs/environment.md). */
export const MATCH_START_DROP_DEPTH_M = 15;
const MATCH_START_DROP_OFFSET_FROM_BULKHEAD_M = 30;

/** Z extent of the match-start drop band (30…45 m from bulkhead; alpha `−120…−105`, beta `+105…+120`). */
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

/** Evenly spaced Z inside the spawn pocket (index `0 … count-1`). */
export function spawnPocketZ(faction: FactionTeam, index: number, count: number): number {
  const { minZ, maxZ } = teamSpawnPocketExtentZ(faction);
  const step = (maxZ - minZ) / (count + 1);
  return minZ + step * (index + 1);
}

/** Evenly spaced Z inside the match-start drop band (index `0 … count-1`). */
export function matchStartDropZ(faction: FactionTeam, index: number, count: number): number {
  const { minZ, maxZ } = teamMatchStartDropExtentZ(faction);
  const step = (maxZ - minZ) / (count + 1);
  return minZ + step * (index + 1);
}

/** Gap X for match-start roster slot — cycles front-row shield gaps. */
export function matchStartDropX(index: number): number {
  const gaps = spawnShieldGapCentersX('front');
  if (gaps.length === 0) {
    return 0;
  }

  return gaps[index % gaps.length] ?? 0;
}

/** Walkable gap centers between adjacent cubes in a shield row (5 m slots). */
export function spawnShieldGapCentersX(row: SpawnShieldRowId): readonly number[] {
  const centers = spawnShieldRowCentersX(row);
  const gaps: number[] = [];

  for (let index = 0; index < centers.length - 1; index += 1) {
    gaps.push((centers[index] + centers[index + 1]) * 0.5);
  }

  return gaps;
}

/** Nearest 5 m gap X for bots leaving the spawn pocket. */
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
