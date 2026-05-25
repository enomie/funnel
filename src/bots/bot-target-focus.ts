import type { RigidBody } from '@dimforge/rapier3d-simd-compat';
import type { FactionTeam } from '../combat/teams';
import { areSameFaction } from '../combat/teams';
import { BOT_SIGHT_RANGE_M, type BotBrainTarget } from './bot-objective';
import {
  fillNearestHostileTarget,
  type BotCombatTargetSnapshot,
  type MutableBotBrainTarget
} from './bot-targeting';

const BOT_SIGHT_RANGE_SQ = BOT_SIGHT_RANGE_M * BOT_SIGHT_RANGE_M;

/** New hostile must be this much closer (linear) to steal focus — reduces target flicker. */
const TARGET_STEAL_LINEAR_RATIO = 0.55;
const TARGET_STEAL_DIST_SQ = TARGET_STEAL_LINEAR_RATIO * TARGET_STEAL_LINEAR_RATIO;

function planarDistSq(ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  return dx * dx + dz * dz;
}

function fillTargetFromSnapshot(
  snapshot: BotCombatTargetSnapshot,
  out: MutableBotBrainTarget
): BotBrainTarget {
  out.x = snapshot.x;
  out.y = snapshot.y;
  out.z = snapshot.z;
  out.body = snapshot.body;
  return out;
}

/** Sticky hostile selection — nearest only wins when clearly closer or focus is lost. */
export class BotTargetFocus {
  #bodyHandle: number | null = null;
  readonly #targetScratch: MutableBotBrainTarget = {
    x: 0,
    y: 0,
    z: 0,
    body: null as unknown as RigidBody
  };

  reset(): void {
    this.#bodyHandle = null;
  }

  resolve(
    botX: number,
    botZ: number,
    botFaction: FactionTeam,
    selfBody: RigidBody,
    candidates: readonly BotCombatTargetSnapshot[]
  ): BotBrainTarget | null {
    const scratch = this.#targetScratch;
    const hasNearest = fillNearestHostileTarget(
      botX,
      botZ,
      botFaction,
      selfBody,
      candidates,
      scratch
    );
    const nearest = hasNearest ? scratch : null;

    if (this.#bodyHandle === null) {
      this.#bodyHandle = nearest?.body.handle ?? null;
      return nearest;
    }

    const focused = this.#findFocused(botFaction, candidates);
    if (focused === null) {
      this.#bodyHandle = nearest?.body.handle ?? null;
      return nearest;
    }

    if (planarDistSq(botX, botZ, focused.x, focused.z) > BOT_SIGHT_RANGE_SQ) {
      this.#bodyHandle = null;
      return nearest;
    }

    if (nearest === null || nearest.body.handle === this.#bodyHandle) {
      return focused;
    }

    const focusedDistSq = planarDistSq(botX, botZ, focused.x, focused.z);
    const nearestDistSq = planarDistSq(botX, botZ, nearest.x, nearest.z);
    if (nearestDistSq < focusedDistSq * TARGET_STEAL_DIST_SQ) {
      this.#bodyHandle = nearest.body.handle;
      return nearest;
    }

    return focused;
  }

  #findFocused(
    botFaction: FactionTeam,
    candidates: readonly BotCombatTargetSnapshot[]
  ): BotBrainTarget | null {
    for (const candidate of candidates) {
      if (candidate.body.handle !== this.#bodyHandle) {
        continue;
      }

      if (candidate.isDead || areSameFaction(candidate.faction, botFaction)) {
        this.#bodyHandle = null;
        return null;
      }

      return fillTargetFromSnapshot(candidate, this.#targetScratch);
    }

    this.#bodyHandle = null;
    return null;
  }
}
