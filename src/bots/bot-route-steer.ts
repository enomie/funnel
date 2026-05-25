// Path: /Users/johann/MyBrew/funnel-real/src/bots/bot-route-steer.ts

import type { RigidBody, World } from '@dimforge/rapier3d-simd-compat';
import {
  isRouteSteerProbeDue,
  tryAcquireRouteSteerFanRefresh
} from './bot-nav-ray-budget';
import {
  botClearanceComfortT,
  BOT_OBSTACLE_STANDOFF_CENTER_M,
  peelYawsInto,
  probeBodyCastAhead,
  STEER_CAST_MAX_M,
  STEER_FAN_ANGLES_RAD
} from './bot-body-probe';

const STEER_LOOKAHEAD_M = 6;

const STEER_GOAL_REUSE_M = 0.85;

const STEER_PHASE_SLOT_COUNT = 12;

const _steerCandidateYaws: number[] = [];
const _steerCandidateClearances: number[] = [];

export interface BotRouteSteerSnapshot {
  readonly moveYaw: number;
  readonly steerX: number;
  readonly steerZ: number;
  readonly steering: boolean;
}

type MutableBotRouteSteerSnapshot = {
  moveYaw: number;
  steerX: number;
  steerZ: number;
  steering: boolean;
};

export interface BotRouteSteerInput {
  readonly world: World;
  readonly excludeBody: RigidBody;
  readonly botX: number;
  readonly botY: number;
  readonly botZ: number;
  readonly goalX: number;
  readonly goalZ: number;
  readonly priorMoveYaw?: number;
}

export class BotRouteSteerCache {
  #moveYaw = 0;
  #steerX = 0;
  #steerZ = 0;
  #steering = false;
  #phaseSlot = 0;
  #phaseSlotCount = 1;
  #lastGoalX = 0;
  #lastGoalZ = 0;
  #lastPathClear = true;
  readonly #peekScratch: MutableBotRouteSteerSnapshot = {
    moveYaw: 0,
    steerX: 0,
    steerZ: 0,
    steering: false
  };
  readonly #inputScratch: {
    world: World;
    excludeBody: RigidBody;
    botX: number;
    botY: number;
    botZ: number;
    goalX: number;
    goalZ: number;
    priorMoveYaw?: number;
  } = {
    world: null as unknown as World,
    excludeBody: null as unknown as RigidBody,
    botX: 0,
    botY: 0,
    botZ: 0,
    goalX: 0,
    goalZ: 0
  };

  reset(x: number, z: number, yaw: number, phaseSlot = 0, phaseSlotCount = 1): void {
    this.#moveYaw = yaw;
    this.#steerX = x;
    this.#steerZ = z;
    this.#steering = false;
    const slots = Math.max(1, Math.min(STEER_PHASE_SLOT_COUNT, phaseSlotCount));
    this.#phaseSlot = ((phaseSlot % slots) + slots) % slots;
    this.#phaseSlotCount = slots;
    this.#lastGoalX = x;
    this.#lastGoalZ = z;
    this.#lastPathClear = true;
  }

  peek(): BotRouteSteerSnapshot {
    const scratch = this.#peekScratch;
    scratch.moveYaw = this.#moveYaw;
    scratch.steerX = this.#steerX;
    scratch.steerZ = this.#steerZ;
    scratch.steering = this.#steering;
    return scratch as BotRouteSteerSnapshot;
  }

  fillStuckInput(
    world: World,
    excludeBody: RigidBody,
    botX: number,
    botY: number,
    botZ: number,
    goalX: number,
    goalZ: number,
    priorMoveYaw?: number
  ): void {
    const scratch = this.#inputScratch;
    scratch.world = world;
    scratch.excludeBody = excludeBody;
    scratch.botX = botX;
    scratch.botY = botY;
    scratch.botZ = botZ;
    scratch.goalX = goalX;
    scratch.goalZ = goalZ;
    scratch.priorMoveYaw = priorMoveYaw;
  }

  updateInPlace(): BotRouteSteerSnapshot {
    return this.update(this.#inputScratch);
  }

  update(input: BotRouteSteerInput): BotRouteSteerSnapshot {
    const dx = input.goalX - input.botX;
    const dz = input.goalZ - input.botZ;
    const distance = Math.hypot(dx, dz);
    if (distance <= 0.05) {
      this.#steering = false;
      this.#moveYaw = input.priorMoveYaw ?? 0;
      this.#steerX = input.goalX;
      this.#steerZ = input.goalZ;
      this.#lastGoalX = input.goalX;
      this.#lastGoalZ = input.goalZ;
      this.#lastPathClear = true;
      return this.peek();
    }

    const goalDirX = dx / distance;
    const goalDirZ = dz / distance;
    const goalYaw = Math.atan2(goalDirX, goalDirZ);
    const goalDelta = Math.hypot(input.goalX - this.#lastGoalX, input.goalZ - this.#lastGoalZ);
    const goalMoved = goalDelta >= STEER_GOAL_REUSE_M;

    if (
      !this.#steering &&
      this.#lastPathClear &&
      !goalMoved &&
      !isRouteSteerProbeDue(this.#phaseSlot, this.#phaseSlotCount)
    ) {
      this.#applyClearGoal(goalYaw, input.goalX, input.goalZ);
      return this.peek();
    }

    const forward = probeBodyCastAhead(
      input.world,
      input.excludeBody,
      input.botX,
      input.botY,
      input.botZ,
      goalDirX,
      goalDirZ,
      STEER_CAST_MAX_M
    );

    this.#lastGoalX = input.goalX;
    this.#lastGoalZ = input.goalZ;

    if (!forward.pathBlocked) {
      this.#lastPathClear = true;
      this.#applyClearGoal(goalYaw, input.goalX, input.goalZ);
      return this.peek();
    }

    this.#lastPathClear = false;

    if (!tryAcquireRouteSteerFanRefresh()) {
      return this.peek();
    }

    this.#resolveBlockedPath(input, goalDirX, goalDirZ, goalYaw, forward.clearanceM, forward.hitNormalX, forward.hitNormalZ);
    return this.peek();
  }

  #applyClearGoal(goalYaw: number, goalX: number, goalZ: number): void {
    this.#steering = false;
    this.#moveYaw = goalYaw;
    this.#steerX = goalX;
    this.#steerZ = goalZ;
  }

  #resolveBlockedPath(
    input: BotRouteSteerInput,
    goalDirX: number,
    goalDirZ: number,
    goalYaw: number,
    forwardClearanceM: number,
    hitNormalX: number,
    hitNormalZ: number
  ): void {
    const candidateCount = fillSteerCandidateYaws(
      goalYaw,
      goalDirX,
      goalDirZ,
      hitNormalX,
      hitNormalZ
    );

    let bestYaw = goalYaw;
    let bestScore = -Infinity;
    let bestClearance = forwardClearanceM;

    for (let index = 0; index < candidateCount; index += 1) {
      const yaw = _steerCandidateYaws[index];
      const dirX = Math.sin(yaw);
      const dirZ = Math.cos(yaw);
      const cast = probeBodyCastAhead(
        input.world,
        input.excludeBody,
        input.botX,
        input.botY,
        input.botZ,
        dirX,
        dirZ,
        STEER_CAST_MAX_M
      );
      const alignment = dirX * goalDirX + dirZ * goalDirZ;
      const turnPenalty = turnHysteresisPenalty(input.priorMoveYaw, yaw);
      const score =
        botClearanceComfortT(cast.clearanceM, STEER_CAST_MAX_M) * 1.15 +
        Math.max(alignment, 0) * 0.65 -
        turnPenalty;

      _steerCandidateClearances[index] = cast.clearanceM;

      if (score > bestScore) {
        bestScore = score;
        bestYaw = yaw;
        bestClearance = cast.clearanceM;
      }
    }

    if (bestClearance <= BOT_OBSTACLE_STANDOFF_CENTER_M) {
      const peelYaw = pickMaxClearanceFromCache(candidateCount);
      if (peelYaw !== null) {
        bestYaw = peelYaw.yaw;
        bestClearance = peelYaw.clearanceM;
      }
    }

    const bestDirX = Math.sin(bestYaw);
    const bestDirZ = Math.cos(bestYaw);
    this.#steering = bestClearance > forwardClearanceM + 0.04 || bestYaw !== goalYaw;
    this.#moveYaw = bestYaw;
    this.#steerX = input.botX + bestDirX * STEER_LOOKAHEAD_M;
    this.#steerZ = input.botZ + bestDirZ * STEER_LOOKAHEAD_M;
  }
}

function fillSteerCandidateYaws(
  goalYaw: number,
  goalDirX: number,
  goalDirZ: number,
  hitNormalX: number,
  hitNormalZ: number
): number {
  let count = 0;
  _steerCandidateYaws[count++] = goalYaw;

  for (const offset of STEER_FAN_ANGLES_RAD) {
    _steerCandidateYaws[count++] = goalYaw + offset;
  }

  count += peelYawsInto(_steerCandidateYaws, count, hitNormalX, hitNormalZ, goalDirX, goalDirZ);
  return count;
}

function pickMaxClearanceFromCache(
  candidateCount: number
): { yaw: number; clearanceM: number } | null {
  let best: { yaw: number; clearanceM: number } | null = null;

  for (let index = 0; index < candidateCount; index += 1) {
    const clearanceM = _steerCandidateClearances[index];
    if (best === null || clearanceM > best.clearanceM) {
      best = { yaw: _steerCandidateYaws[index], clearanceM };
    }
  }

  return best;
}

function turnHysteresisPenalty(priorMoveYaw: number | undefined, yaw: number): number {
  if (priorMoveYaw === undefined) {
    return 0;
  }

  let delta = yaw - priorMoveYaw;
  while (delta > Math.PI) {
    delta -= Math.PI * 2;
  }
  while (delta < -Math.PI) {
    delta += Math.PI * 2;
  }

  return Math.abs(delta) * 0.22;
}
