// Path: /Users/johann/MyBrew/funnel-real/src/combat/match-roster.ts

import {
  matchStartDropX,
  matchStartDropZ,
  spawnPocketZ,
  yawTowardFunnelCenter
} from '../arena/spawn-shield-cubes';
import {
  RAIN_COUNTDOWN_SPAWN_Y_MAX,
  RAIN_COUNTDOWN_SPAWN_Y_MIN
} from '../arena/environment-rain-bounds';
import { FUNNEL_DIMENSIONS, PLAYER_GROUNDED_CENTER_Y } from '../config/game-config';
import { getRuntimeProfile } from '../platform/chrome-macos-arm-profile';
import {
  oppositeFaction,
  type FactionTeam
} from './teams';

export function playersPerTeam(): number {
  return getRuntimeProfile().playersPerTeam;
}

export function matchRosterLimits(): {
  readonly maxAlliedBots: number;
  readonly maxEnemyBots: number;
  readonly maxPlayersPerSide: number;
} {
  const perTeam = playersPerTeam();
  return {
    maxAlliedBots: perTeam - 1,
    maxEnemyBots: perTeam,
    maxPlayersPerSide: 1
  };
}

export function devPlaceholderBotCounts(): { readonly allies: number; readonly enemies: number } {
  const limits = matchRosterLimits();
  return {
    allies: limits.maxAlliedBots,
    enemies: limits.maxEnemyBots
  };
}

const SPAWN_POCKET_LATERAL_MARGIN_M = 1;
const SPAWN_POCKET_MAX_LATERAL_SPACING_M = 8;

export interface BotSpawnSlot {
  readonly faction: FactionTeam;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  
  readonly yaw: number;
}

function matchStartDropCenterY(): number {
  return (RAIN_COUNTDOWN_SPAWN_Y_MIN + RAIN_COUNTDOWN_SPAWN_Y_MAX) * 0.5;
}

export function playerMatchStartSlotIndex(): number {
  return Math.floor((playersPerTeam() - 1) / 2);
}

export function playerMatchStartSpawnSlot(faction: FactionTeam): BotSpawnSlot {
  const teamSize = playersPerTeam();
  const slotIndex = playerMatchStartSlotIndex();
  const dropY = matchStartDropCenterY();

  return {
    faction,
    x: matchStartDropX(slotIndex),
    y: dropY,
    z: matchStartDropZ(faction, slotIndex, teamSize),
    yaw: yawTowardFunnelCenter(faction)
  };
}

function spawnPocketX(index: number, count: number): number {
  if (count <= 1) {
    return 0;
  }

  const maxSpan = FUNNEL_DIMENSIONS.width - SPAWN_POCKET_LATERAL_MARGIN_M * 2;
  const spacing = Math.min(SPAWN_POCKET_MAX_LATERAL_SPACING_M, maxSpan / (count - 1));
  const lateral = index - (count - 1) / 2;
  return lateral * spacing;
}

function pushFactionSpawnPair(
  pairs: { matchStart: BotSpawnSlot; respawn: BotSpawnSlot }[],
  faction: FactionTeam,
  matchStartSlotIndex: number,
  respawnIndex: number,
  matchStartTeamSize: number,
  respawnCount: number,
  gapIndex: number,
  dropY: number
): void {
  pairs.push({
    matchStart: {
      faction,
      x: matchStartDropX(gapIndex),
      y: dropY,
      z: matchStartDropZ(faction, matchStartSlotIndex, matchStartTeamSize),
      yaw: yawTowardFunnelCenter(faction)
    },
    respawn: {
      faction,
      x: spawnPocketX(respawnIndex, respawnCount),
      y: PLAYER_GROUNDED_CENTER_Y,
      z: spawnPocketZ(faction, respawnIndex, respawnCount),
      yaw: yawTowardFunnelCenter(faction)
    }
  });
}

function buildSpawnPairs(
  viewerFaction: FactionTeam
): { matchStart: BotSpawnSlot; respawn: BotSpawnSlot }[] {
  const enemyFaction = oppositeFaction(viewerFaction);
  const botCounts = devPlaceholderBotCounts();
  const teamSize = playersPerTeam();
  const playerSlot = playerMatchStartSlotIndex();
  const dropY = matchStartDropCenterY();
  const pairs: { matchStart: BotSpawnSlot; respawn: BotSpawnSlot }[] = [];

  let allyRespawnIndex = 0;
  for (let slot = 0; slot < teamSize; slot += 1) {
    if (slot === playerSlot) {
      continue;
    }

    pushFactionSpawnPair(
      pairs,
      viewerFaction,
      slot,
      allyRespawnIndex,
      teamSize,
      botCounts.allies,
      slot,
      dropY
    );
    allyRespawnIndex += 1;
  }

  for (let i = 0; i < botCounts.enemies; i++) {
    pushFactionSpawnPair(
      pairs,
      enemyFaction,
      i,
      i,
      teamSize,
      botCounts.enemies,
      i + botCounts.allies,
      dropY
    );
  }

  return pairs;
}

function buildRespawnSlots(viewerFaction: FactionTeam): BotSpawnSlot[] {
  return buildSpawnPairs(viewerFaction).map((pair) => pair.respawn);
}

function buildMatchStartDropSlots(viewerFaction: FactionTeam): BotSpawnSlot[] {
  return buildSpawnPairs(viewerFaction).map((pair) => pair.matchStart);
}


export function devPlaceholderSpawnSlots(viewerFaction: FactionTeam): BotSpawnSlot[] {
  return buildRespawnSlots(viewerFaction);
}


export function devPlaceholderMatchStartSpawnSlots(viewerFaction: FactionTeam): BotSpawnSlot[] {
  return buildMatchStartDropSlots(viewerFaction);
}


export function devPlaceholderRespawnSpawnSlots(viewerFaction: FactionTeam): BotSpawnSlot[] {
  return buildRespawnSlots(viewerFaction);
}


export function devPlaceholderSpawnPairs(
  viewerFaction: FactionTeam
): readonly { readonly matchStart: BotSpawnSlot; readonly respawn: BotSpawnSlot }[] {
  return buildSpawnPairs(viewerFaction);
}
