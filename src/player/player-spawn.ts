import {
  nearestSpawnShieldGapX,
  teamMatchStartDropExtentZ,
  teamSpawnPocketCenterZ
} from '../arena/spawn-shield-cubes';
import {
  RAIN_COUNTDOWN_SPAWN_Y_MAX,
  RAIN_COUNTDOWN_SPAWN_Y_MIN
} from '../arena/environment-rain-bounds';
import { DEFAULT_PLAYER_FACTION, type FactionTeam } from '../combat/teams';
import { PLAYER_CONFIG } from '../config/game-config';

export interface PlayerSpawnTranslation {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Countdown-visible air band for match-start intro drop (humanoid capsule center). */
export function matchStartDropCenterY(): number {
  return (RAIN_COUNTDOWN_SPAWN_Y_MIN + RAIN_COUNTDOWN_SPAWN_Y_MAX) * 0.5;
}

/** Team spawn pocket center — death respawn + dev faction flip (0…15 m from bulkhead). */
export function playerFactionSpawnPosition(faction: FactionTeam): PlayerSpawnTranslation {
  return {
    x: PLAYER_CONFIG.spawn.x,
    y: PLAYER_CONFIG.spawn.y,
    z: teamSpawnPocketCenterZ(faction)
  };
}

/** Match-start intro drop — air spawn in front of shield cubes (30…45 m from bulkhead). */
export function playerMatchStartDropPosition(faction: FactionTeam): PlayerSpawnTranslation {
  const { minZ, maxZ } = teamMatchStartDropExtentZ(faction);

  return {
    x: nearestSpawnShieldGapX('front', PLAYER_CONFIG.spawn.x),
    y: matchStartDropCenterY(),
    z: (minZ + maxZ) * 0.5
  };
}

export function defaultPlayerSpawnPosition(): PlayerSpawnTranslation {
  return playerFactionSpawnPosition(DEFAULT_PLAYER_FACTION);
}

export function defaultPlayerMatchStartDropPosition(): PlayerSpawnTranslation {
  return playerMatchStartDropPosition(DEFAULT_PLAYER_FACTION);
}
