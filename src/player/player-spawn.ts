// Path: /Users/johann/MyBrew/funnel-real/src/player/player-spawn.ts

import { teamSpawnPocketCenterZ } from '../arena/spawn-shield-cubes';
import { playerMatchStartSpawnSlot } from '../combat/match-roster';
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


export function matchStartDropCenterY(): number {
  return (RAIN_COUNTDOWN_SPAWN_Y_MIN + RAIN_COUNTDOWN_SPAWN_Y_MAX) * 0.5;
}


export function playerFactionSpawnPosition(faction: FactionTeam): PlayerSpawnTranslation {
  return {
    x: PLAYER_CONFIG.spawn.x,
    y: PLAYER_CONFIG.spawn.y,
    z: teamSpawnPocketCenterZ(faction)
  };
}


export function playerMatchStartDropPosition(faction: FactionTeam): PlayerSpawnTranslation {
  const slot = playerMatchStartSpawnSlot(faction);
  return { x: slot.x, y: slot.y, z: slot.z };
}

export function defaultPlayerSpawnPosition(): PlayerSpawnTranslation {
  return playerFactionSpawnPosition(DEFAULT_PLAYER_FACTION);
}

export function defaultPlayerMatchStartDropPosition(): PlayerSpawnTranslation {
  return playerMatchStartDropPosition(DEFAULT_PLAYER_FACTION);
}
