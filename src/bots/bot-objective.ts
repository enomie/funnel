import type { RigidBody } from '@dimforge/rapier3d-simd-compat';
import { isInEnemyTerritory } from '../arena/funnel-zones';
import { funnelZoneExtentZ } from '../config/game-config';
import { oppositeFaction, TEAM_DEFINITIONS, type FactionTeam } from '../combat/teams';

/** Max planar range (m) to spot a hostile — beyond this, push into enemy territory. */
export const BOT_SIGHT_RANGE_M = 150;

export interface BotBrainTarget {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly body: RigidBody;
}

/** FIGHT > HUNT > PUSH — one mode per think step. */
export type BotObjectiveMode = 'push' | 'hunt' | 'fight';

export interface BotObjectiveInput {
  readonly botX: number;
  readonly botY: number;
  readonly botZ: number;
  readonly faction: FactionTeam;
  readonly target: BotBrainTarget | null;
  readonly hasLineOfSight: boolean;
  readonly fireRangeM: number;
  readonly canFire: boolean;
}

export interface BotObjective {
  readonly mode: BotObjectiveMode;
  readonly goalX: number;
  readonly goalZ: number;
  readonly aimYaw: number;
  readonly aimPitch: number;
  readonly wantsFire: boolean;
}

export type MutableBotObjective = {
  mode: BotObjectiveMode;
  goalX: number;
  goalZ: number;
  aimYaw: number;
  aimPitch: number;
  wantsFire: boolean;
};

/** Keep advancing while already in enemy home (m). */
const PUSH_OVERSHOOT_M = 28;
/** Ignore a hostile behind us beyond this planar gap (m) — keep pushing. */
const RETREAT_TARGET_GAP_M = 2;

const _pushGoalScratch = { x: 0, z: 0 };
const _aimScratch = { aimYaw: 0, aimPitch: 0, planarDistance: 0 };

function pushSign(faction: FactionTeam): number {
  return faction === 'alpha' ? 1 : -1;
}

function enemyZoneCenterZ(faction: FactionTeam): number {
  const enemy = oppositeFaction(faction);
  const zoneIndex = enemy === 'alpha' ? 0 : 2;
  const { minZ, maxZ } = funnelZoneExtentZ(zoneIndex);
  return (minZ + maxZ) * 0.5;
}

function fillPushGoal(
  botX: number,
  botZ: number,
  faction: FactionTeam,
  out: { x: number; z: number } = _pushGoalScratch
): { x: number; z: number } {
  const enemySpawnZ = TEAM_DEFINITIONS[oppositeFaction(faction)].spawnZ;

  if (isInEnemyTerritory(faction, botZ)) {
    out.x = botX;
    out.z = enemySpawnZ + pushSign(faction) * PUSH_OVERSHOOT_M;
    return out;
  }

  out.x = botX;
  out.z = enemyZoneCenterZ(faction);
  return out;
}

function targetPullsBack(botZ: number, targetZ: number, faction: FactionTeam): boolean {
  const sign = pushSign(faction);
  return sign > 0 ? targetZ < botZ - RETREAT_TARGET_GAP_M : targetZ > botZ + RETREAT_TARGET_GAP_M;
}

function fillAimAtTarget(
  botX: number,
  botY: number,
  botZ: number,
  target: BotBrainTarget,
  out: { aimYaw: number; aimPitch: number; planarDistance: number } = _aimScratch
): { aimYaw: number; aimPitch: number; planarDistance: number } {
  const dx = target.x - botX;
  const dz = target.z - botZ;
  const planarDistance = Math.hypot(dx, dz);
  out.aimYaw = Math.atan2(dx, dz);
  out.aimPitch = Math.atan2(target.y - botY, Math.max(planarDistance, 0.001));
  out.planarDistance = planarDistance;
  return out;
}

function fillPushObjective(
  botX: number,
  botZ: number,
  faction: FactionTeam,
  aimYaw: number,
  out: MutableBotObjective,
  aimPitch = 0
): void {
  const push = fillPushGoal(botX, botZ, faction);
  out.mode = 'push';
  out.goalX = push.x;
  out.goalZ = push.z;
  out.aimYaw = aimYaw;
  out.aimPitch = aimPitch;
  out.wantsFire = false;
}

export function fillBotObjective(input: BotObjectiveInput, out: MutableBotObjective): void {
  const push = fillPushGoal(input.botX, input.botZ, input.faction);

  if (input.target === null) {
    fillPushObjective(input.botX, input.botZ, input.faction, Math.atan2(0, push.z - input.botZ), out);
    return;
  }

  const aim = fillAimAtTarget(input.botX, input.botY, input.botZ, input.target);

  const canSee =
    aim.planarDistance <= BOT_SIGHT_RANGE_M && input.hasLineOfSight;

  if (!canSee) {
    fillPushObjective(input.botX, input.botZ, input.faction, Math.atan2(0, push.z - input.botZ), out);
    return;
  }

  if (aim.planarDistance <= input.fireRangeM) {
    out.mode = 'fight';
    out.goalX = input.target.x;
    out.goalZ = input.target.z;
    out.aimYaw = aim.aimYaw;
    out.aimPitch = aim.aimPitch;
    out.wantsFire = input.canFire;
    return;
  }

  if (targetPullsBack(input.botZ, input.target.z, input.faction)) {
    fillPushObjective(input.botX, input.botZ, input.faction, aim.aimYaw, out, aim.aimPitch);
    return;
  }

  out.mode = 'hunt';
  out.goalX = input.target.x;
  out.goalZ = input.target.z;
  out.aimYaw = aim.aimYaw;
  out.aimPitch = aim.aimPitch;
  out.wantsFire = false;
}

/** @deprecated Use `fillBotObjective`. */
export function resolveBotObjective(input: BotObjectiveInput): BotObjective {
  const scratch: MutableBotObjective = {
    mode: 'push',
    goalX: 0,
    goalZ: 0,
    aimYaw: 0,
    aimPitch: 0,
    wantsFire: false
  };
  fillBotObjective(input, scratch);
  return scratch;
}
