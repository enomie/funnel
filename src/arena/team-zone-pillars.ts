import type { World } from '@dimforge/rapier3d-simd-compat';
import { FUNNEL_DIMENSIONS } from '../config/game-config';
import type { FactionTeam } from '../combat/teams';
import type { ArenaStaticInstances } from './arena-static-instances';
import { addFixedEnvironmentBox } from './environment-cube';
import type { FunnelZoneId } from './funnel-zones';
import { teamZonePodiumSlots, type TeamZonePodiumSide } from './team-zone-podiums';

/** 5×5 m footprint — grid-aligned. */
export const TEAM_ZONE_PILLAR_SIZE_M = 5;
/** Floor to ceiling — matches `FUNNEL_DIMENSIONS.height`. */
export const TEAM_ZONE_PILLAR_HEIGHT_M = FUNNEL_DIMENSIONS.height;

/** Offset from jump-pad podiums toward team bulkhead. */
export const TEAM_ZONE_PILLAR_BULKHEAD_OFFSET_M = 15;
/** Offset from jump-pad podiums toward side walls. */
export const TEAM_ZONE_PILLAR_WALL_OFFSET_M = 5;

const PILLAR_CENTER_Y = TEAM_ZONE_PILLAR_HEIGHT_M * 0.5;

export interface TeamZonePillarSlot {
  readonly faction: FactionTeam;
  readonly side: TeamZonePodiumSide;
  readonly x: number;
  readonly z: number;
}

function factionZoneId(faction: FactionTeam): Extract<FunnelZoneId, 'alpha' | 'beta'> {
  return faction;
}

/** Two flank pillars per team zone — same layout as podiums, shifted toward bulkhead and side walls. */
export function teamZonePillarSlots(faction: FactionTeam): readonly TeamZonePillarSlot[] {
  const towardBulkhead = faction === 'alpha' ? -1 : 1;

  return teamZonePodiumSlots(faction).map((podium) => {
    const towardWall = podium.side === 'left' ? -1 : 1;
    return {
      faction: podium.faction,
      side: podium.side,
      x: podium.x + towardWall * TEAM_ZONE_PILLAR_WALL_OFFSET_M,
      z: podium.z + towardBulkhead * TEAM_ZONE_PILLAR_BULKHEAD_OFFSET_M
    };
  });
}

/** Two 5×5×50 m pillars per team zone — not on jump-pad podiums. */
export function createTeamZonePillars(instances: ArenaStaticInstances, world: World): void {
  for (const faction of ['alpha', 'beta'] as const) {
    for (const slot of teamZonePillarSlots(faction)) {
      addFixedEnvironmentBox(
        instances,
        world,
        [slot.x, PILLAR_CENTER_Y, slot.z],
        [TEAM_ZONE_PILLAR_SIZE_M, TEAM_ZONE_PILLAR_HEIGHT_M, TEAM_ZONE_PILLAR_SIZE_M],
        factionZoneId(faction)
      );
    }
  }
}
