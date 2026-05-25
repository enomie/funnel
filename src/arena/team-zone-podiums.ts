// Path: /Users/johann/MyBrew/funnel-real/src/arena/team-zone-podiums.ts

import type { World } from '@dimforge/rapier3d-simd-compat';
import { FUNNEL_DIMENSIONS, funnelZoneExtentZ } from '../config/game-config';
import type { FactionTeam } from '../combat/teams';
import type { ArenaStaticInstances } from './arena-static-instances';
import { addFixedEnvironmentBox } from './environment-cube';
import type { FunnelZoneId } from './funnel-zones';


export const TEAM_ZONE_PODIUM_SIZE_M = 5;
export const TEAM_ZONE_PODIUM_HEIGHT_M = 1;

const PODIUM_HALF_M = TEAM_ZONE_PODIUM_SIZE_M * 0.5;
export const TEAM_ZONE_PODIUM_HALF_M = PODIUM_HALF_M;
const PODIUM_CENTER_Y = TEAM_ZONE_PODIUM_HEIGHT_M * 0.5;


export const TEAM_ZONE_PODIUM_INSET_M = 15;

export type TeamZonePodiumSide = 'left' | 'right';

export interface TeamZonePodiumSlot {
  readonly faction: FactionTeam;
  readonly side: TeamZonePodiumSide;
  readonly x: number;
  readonly z: number;
}

function teamZonePodiumZ(faction: FactionTeam): number {
  const towardBulkhead = faction === 'alpha' ? -1 : 1;
  const neutralBorderZ =
    faction === 'alpha' ? funnelZoneExtentZ(0).maxZ : funnelZoneExtentZ(2).minZ;

  return neutralBorderZ + towardBulkhead * (TEAM_ZONE_PODIUM_INSET_M + PODIUM_HALF_M);
}

function teamZonePodiumX(side: TeamZonePodiumSide): number {
  const halfW = FUNNEL_DIMENSIONS.width * 0.5;
  return side === 'left'
    ? -halfW + TEAM_ZONE_PODIUM_INSET_M + PODIUM_HALF_M
    : halfW - TEAM_ZONE_PODIUM_INSET_M - PODIUM_HALF_M;
}


export function teamZonePodiumSlots(faction: FactionTeam): readonly TeamZonePodiumSlot[] {
  const z = teamZonePodiumZ(faction);
  const sides: readonly TeamZonePodiumSide[] = ['left', 'right'];

  return sides.map((side) => ({
    faction,
    side,
    x: teamZonePodiumX(side),
    z
  }));
}

function factionZoneId(faction: FactionTeam): Extract<FunnelZoneId, 'alpha' | 'beta'> {
  return faction;
}

function addTeamZonePodium(
  instances: ArenaStaticInstances,
  world: World,
  slot: TeamZonePodiumSlot
): void {
  addFixedEnvironmentBox(
    instances,
    world,
    [slot.x, PODIUM_CENTER_Y, slot.z],
    [TEAM_ZONE_PODIUM_SIZE_M, TEAM_ZONE_PODIUM_HEIGHT_M, TEAM_ZONE_PODIUM_SIZE_M],
    factionZoneId(slot.faction)
  );
}


export function createTeamZonePodiums(instances: ArenaStaticInstances, world: World): void {
  for (const faction of ['alpha', 'beta'] as const) {
    for (const slot of teamZonePodiumSlots(faction)) {
      addTeamZonePodium(instances, world, slot);
    }
  }
}
