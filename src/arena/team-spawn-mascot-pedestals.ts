// Path: /Users/johann/MyBrew/funnel-real/src/arena/team-spawn-mascot-pedestals.ts

import type { World } from '@dimforge/rapier3d-simd-compat';
import { FACTION_TEAMS, type FactionTeam } from '../combat/teams';
import type { ArenaStaticInstances } from './arena-static-instances';
import { addFixedEnvironmentBox } from './environment-cube';
import type { FunnelZoneId } from './funnel-zones';
import {
  isTeamSpawnMascotsEnabled,
  teamSpawnMascotPedestalCenterY,
  teamSpawnMascotZ,
  TEAM_SPAWN_MASCOT_PEDESTAL_HEIGHT_M,
  TEAM_SPAWN_MASCOT_PEDESTAL_SIZE_M
} from './team-spawn-mascots';

function factionZoneId(faction: FactionTeam): Extract<FunnelZoneId, 'alpha' | 'beta'> {
  return faction;
}

function addTeamSpawnMascotPedestal(
  instances: ArenaStaticInstances,
  world: World,
  faction: FactionTeam
): void {
  addFixedEnvironmentBox(
    instances,
    world,
    [0, teamSpawnMascotPedestalCenterY(), teamSpawnMascotZ(faction)],
    [
      TEAM_SPAWN_MASCOT_PEDESTAL_SIZE_M,
      TEAM_SPAWN_MASCOT_PEDESTAL_HEIGHT_M,
      TEAM_SPAWN_MASCOT_PEDESTAL_SIZE_M
    ],
    factionZoneId(faction)
  );
}

export function createTeamSpawnMascotPedestals(
  instances: ArenaStaticInstances,
  world: World
): void {
  if (!isTeamSpawnMascotsEnabled()) {
    return;
  }

  for (const faction of FACTION_TEAMS) {
    addTeamSpawnMascotPedestal(instances, world, faction);
  }
}
