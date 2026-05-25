import {
  matchStartDropX,
  matchStartDropZ,
  spawnPocketZ
} from '../arena/spawn-shield-cubes';
import { matchStartDropCenterY } from '../player/player-spawn';
import { FUNNEL_DIMENSIONS, PLAYER_GROUNDED_CENTER_Y } from '../config/game-config';
import { getRuntimeProfile } from '../platform/chrome-macos-arm-profile';
import {
  oppositeFaction,
  TEAM_DEFINITIONS,
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
  /** Y rotation (radians), facing toward funnel center. */
  readonly yaw: number;
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

function yawTowardFunnelCenter(faction: FactionTeam): number {
  const towardCenter = -Math.sign(TEAM_DEFINITIONS[faction].spawnZ);
  return towardCenter * Math.PI;
}

function pushFactionSpawnPair(
  pairs: { matchStart: BotSpawnSlot; respawn: BotSpawnSlot }[],
  faction: FactionTeam,
  index: number,
  count: number,
  gapIndex: number,
  dropY: number
): void {
  pairs.push({
    matchStart: {
      faction,
      x: matchStartDropX(gapIndex),
      y: dropY,
      z: matchStartDropZ(faction, index, count),
      yaw: yawTowardFunnelCenter(faction)
    },
    respawn: {
      faction,
      x: spawnPocketX(index, count),
      y: PLAYER_GROUNDED_CENTER_Y,
      z: spawnPocketZ(faction, index, count),
      yaw: yawTowardFunnelCenter(faction)
    }
  });
}

function buildSpawnPairs(
  viewerFaction: FactionTeam
): { matchStart: BotSpawnSlot; respawn: BotSpawnSlot }[] {
  const enemyFaction = oppositeFaction(viewerFaction);
  const botCounts = devPlaceholderBotCounts();
  const dropY = matchStartDropCenterY();
  const pairs: { matchStart: BotSpawnSlot; respawn: BotSpawnSlot }[] = [];

  for (let i = 0; i < botCounts.allies; i++) {
    pushFactionSpawnPair(pairs, viewerFaction, i, botCounts.allies, i, dropY);
  }

  for (let i = 0; i < botCounts.enemies; i++) {
    pushFactionSpawnPair(pairs, enemyFaction, i, botCounts.enemies, i + botCounts.allies, dropY);
  }

  return pairs;
}

function buildRespawnSlots(viewerFaction: FactionTeam): BotSpawnSlot[] {
  return buildSpawnPairs(viewerFaction).map((pair) => pair.respawn);
}

function buildMatchStartDropSlots(viewerFaction: FactionTeam): BotSpawnSlot[] {
  return buildSpawnPairs(viewerFaction).map((pair) => pair.matchStart);
}

/** @deprecated Use `devPlaceholderMatchStartSpawnSlots` or `devPlaceholderRespawnSpawnSlots`. */
export function devPlaceholderSpawnSlots(viewerFaction: FactionTeam): BotSpawnSlot[] {
  return buildRespawnSlots(viewerFaction);
}

/** Countdown intro — air drop in front of shield cubes (30…45 m from bulkhead). */
export function devPlaceholderMatchStartSpawnSlots(viewerFaction: FactionTeam): BotSpawnSlot[] {
  return buildMatchStartDropSlots(viewerFaction);
}

/** Death respawn — spawn pocket behind rear shields (0…15 m from bulkhead). */
export function devPlaceholderRespawnSpawnSlots(viewerFaction: FactionTeam): BotSpawnSlot[] {
  return buildRespawnSlots(viewerFaction);
}

/** Match-start + respawn slot pairs — same roster index. */
export function devPlaceholderSpawnPairs(
  viewerFaction: FactionTeam
): readonly { readonly matchStart: BotSpawnSlot; readonly respawn: BotSpawnSlot }[] {
  return buildSpawnPairs(viewerFaction);
}
