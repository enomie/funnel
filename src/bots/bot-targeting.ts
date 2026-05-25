import type { RigidBody } from '@dimforge/rapier3d-simd-compat';
import type { FactionTeam } from '../combat/teams';
import { areSameFaction } from '../combat/teams';
import { BOT_SIGHT_RANGE_M, type BotBrainTarget } from './bot-objective';

const BOT_SIGHT_RANGE_SQ = BOT_SIGHT_RANGE_M * BOT_SIGHT_RANGE_M;

export interface BotCombatTargetSnapshot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly faction: FactionTeam;
  readonly body: RigidBody;
  readonly isDead: boolean;
}

export type MutableBotBrainTarget = {
  x: number;
  y: number;
  z: number;
  body: RigidBody;
};

/** @returns `true` when a hostile was written to `out`. */
export function fillNearestHostileTarget(
  botX: number,
  botZ: number,
  botFaction: FactionTeam,
  selfBody: RigidBody,
  candidates: readonly BotCombatTargetSnapshot[],
  out: MutableBotBrainTarget
): boolean {
  let nearestDistSq = Infinity;
  let found = false;

  for (const candidate of candidates) {
    if (candidate.isDead || areSameFaction(candidate.faction, botFaction)) {
      continue;
    }

    if (candidate.body.handle === selfBody.handle) {
      continue;
    }

    const dx = candidate.x - botX;
    const dz = candidate.z - botZ;
    const distSq = dx * dx + dz * dz;
    if (distSq > BOT_SIGHT_RANGE_SQ || distSq >= nearestDistSq) {
      continue;
    }

    nearestDistSq = distSq;
    out.x = candidate.x;
    out.y = candidate.y;
    out.z = candidate.z;
    out.body = candidate.body;
    found = true;
  }

  return found;
}

/** @deprecated Use `fillNearestHostileTarget`. */
export function resolveNearestHostileTarget(
  botX: number,
  botZ: number,
  botFaction: FactionTeam,
  selfBody: RigidBody,
  candidates: readonly BotCombatTargetSnapshot[]
): BotBrainTarget | null {
  const scratch: MutableBotBrainTarget = { x: 0, y: 0, z: 0, body: selfBody };
  return fillNearestHostileTarget(botX, botZ, botFaction, selfBody, candidates, scratch)
    ? scratch
    : null;
}
