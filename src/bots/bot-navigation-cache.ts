import { tryAcquireNavRayRefresh } from './bot-nav-ray-budget';
import { BOT_BRAIN_STEP_S } from './bot-brain';
import {
  fillBotNavigationGoal,
  resolveNavStuckPhase,
  resolvePeelSign,
  type BotNavigationGoal,
  type BotNavigationInput,
  type MutableBotNavigationResult,
  type NavStuckPhase
} from './bot-navigation';

const BEARING_LOCK_BY_PHASE: Record<NavStuckPhase, number> = {
  seek: 0,
  widen: 14,
  peel: 26,
  escape: 42
};

const NAV_ACCUMULATOR_CAP_S = BOT_BRAIN_STEP_S * 4;
/** Deterministic slot spread — bots stagger refreshes across one brain tick window. */
const NAV_PHASE_SLOT_COUNT = 12;
/** Seek-mode nav runs at this fraction of brain tick rate (fewer ray fans while cruising). */
const NAV_SEEK_REFRESH_BRAIN_MULTIPLIER = 2;

export interface BotNavigationSnapshot extends BotNavigationGoal {
  readonly moveYaw: number;
}

type MutableBotNavigationSnapshot = {
  x: number;
  z: number;
  moveYaw: number;
};

interface MutableBotNavigationInput {
  world: BotNavigationInput['world'];
  excludeBody: BotNavigationInput['excludeBody'];
  botX: number;
  botY: number;
  botZ: number;
  faction: BotNavigationInput['faction'];
  goalX: number;
  goalZ: number;
  stuckFrames: number;
  priorMoveYaw?: number;
  peelSign?: 1 | -1;
}

export class BotNavigationCache {
  readonly #goal = { x: 0, z: 0 };
  #moveYaw = 0;
  #accumulator = 0;
  #bearingLockSteps = 0;
  #peelSign: 1 | -1 | null = null;
  readonly #peekScratch: MutableBotNavigationSnapshot = {
    x: 0,
    z: 0,
    moveYaw: 0
  };
  readonly #navInputScratch: MutableBotNavigationInput = {
    world: null as unknown as BotNavigationInput['world'],
    excludeBody: null as unknown as BotNavigationInput['excludeBody'],
    botX: 0,
    botY: 0,
    botZ: 0,
    faction: 'alpha',
    goalX: 0,
    goalZ: 0,
    stuckFrames: 0,
    priorMoveYaw: 0
  };
  readonly #navResultScratch: MutableBotNavigationResult = { x: 0, z: 0, moveYaw: 0 };

  get moveYaw(): number {
    return this.#moveYaw;
  }

  get steeredGoal(): BotNavigationGoal {
    return this.#goal;
  }

  fillStuckInput(
    world: BotNavigationInput['world'],
    excludeBody: BotNavigationInput['excludeBody'],
    botX: number,
    botY: number,
    botZ: number,
    faction: BotNavigationInput['faction'],
    goalX: number,
    goalZ: number,
    stuckFrames: number
  ): void {
    const scratch = this.#navInputScratch;
    scratch.world = world;
    scratch.excludeBody = excludeBody;
    scratch.botX = botX;
    scratch.botY = botY;
    scratch.botZ = botZ;
    scratch.faction = faction;
    scratch.goalX = goalX;
    scratch.goalZ = goalZ;
    scratch.stuckFrames = stuckFrames;
  }

  updateInPlace(fixedStep: number): BotNavigationSnapshot {
    return this.#update(fixedStep, this.#navInputScratch);
  }

  peek(): BotNavigationSnapshot {
    const scratch = this.#peekScratch;
    scratch.x = this.#goal.x;
    scratch.z = this.#goal.z;
    scratch.moveYaw = this.#moveYaw;
    return scratch as BotNavigationSnapshot;
  }

  reset(x: number, z: number, yaw: number, phaseSlot = 0, phaseSlotCount = 1): void {
    this.#goal.x = x;
    this.#goal.z = z;
    this.#moveYaw = yaw;
    const slots = Math.max(1, Math.min(NAV_PHASE_SLOT_COUNT, phaseSlotCount));
    const slot = ((phaseSlot % slots) + slots) % slots;
    this.#accumulator = slot * (BOT_BRAIN_STEP_S / slots);
    this.#bearingLockSteps = 0;
    this.#peelSign = null;
  }

  update(fixedStep: number, input: BotNavigationInput): BotNavigationSnapshot {
    return this.#update(fixedStep, input);
  }

  #update(fixedStep: number, input: BotNavigationInput): BotNavigationSnapshot {
    const phase = resolveNavStuckPhase(input.stuckFrames);

    if (input.stuckFrames === 0) {
      this.#peelSign = null;
    } else if ((phase === 'peel' || phase === 'escape') && this.#peelSign === null) {
      this.#peelSign = resolvePeelSign(input);
    }

    this.#accumulator += fixedStep;
    if (this.#accumulator > NAV_ACCUMULATOR_CAP_S) {
      this.#accumulator = NAV_ACCUMULATOR_CAP_S;
    }
    const refreshInterval =
      phase === 'seek'
        ? BOT_BRAIN_STEP_S * NAV_SEEK_REFRESH_BRAIN_MULTIPLIER
        : phase === 'widen'
          ? BOT_BRAIN_STEP_S * 0.85
          : BOT_BRAIN_STEP_S * 0.5;
    const due = this.#accumulator >= refreshInterval;

    if (due && tryAcquireNavRayRefresh()) {
      this.#accumulator -= refreshInterval;
      const scratch = this.#navInputScratch;
      scratch.world = input.world;
      scratch.excludeBody = input.excludeBody;
      scratch.botX = input.botX;
      scratch.botY = input.botY;
      scratch.botZ = input.botZ;
      scratch.faction = input.faction;
      scratch.goalX = input.goalX;
      scratch.goalZ = input.goalZ;
      scratch.stuckFrames = input.stuckFrames;
      scratch.priorMoveYaw = this.#moveYaw;
      scratch.peelSign = this.#peelSign ?? undefined;
      fillBotNavigationGoal(scratch, this.#navResultScratch);
      this.#goal.x = this.#navResultScratch.x;
      this.#goal.z = this.#navResultScratch.z;
      this.#moveYaw = this.#navResultScratch.moveYaw;
      if (phase !== 'seek') {
        this.#bearingLockSteps = BEARING_LOCK_BY_PHASE[phase];
      }
    }

    if (this.#bearingLockSteps > 0) {
      this.#bearingLockSteps -= 1;
    }

    return this.peek();
  }
}
