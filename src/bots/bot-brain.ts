// Path: /Users/johann/MyBrew/funnel-real/src/bots/bot-brain.ts

import type { FactionTeam } from '../combat/teams';
import { fillBotObjective, type BotBrainTarget, type BotObjectiveMode, type MutableBotObjective } from './bot-objective';

export type { BotBrainTarget } from './bot-objective';
export { BOT_SIGHT_RANGE_M } from './bot-objective';

import { getRuntimeProfile } from '../platform/chrome-macos-arm-profile';


export const BOT_BRAIN_TICK_HZ = getRuntimeProfile().botBrainTickHz;
export const BOT_BRAIN_STEP_S = 1 / BOT_BRAIN_TICK_HZ;


const MODE_LOCK_THINKS = 2;

export type BotBrainState = 'idle' | BotObjectiveMode;

export interface BotBrainInput {
  readonly botX: number;
  readonly botY: number;
  readonly botZ: number;
  readonly faction: FactionTeam;
  readonly isDead: boolean;
  readonly matchLive: boolean;
  readonly target: BotBrainTarget | null;
  readonly hasLineOfSight: boolean;
  readonly fireRangeM: number;
  readonly canFire: boolean;
}

export interface BotBrainIntent {
  readonly state: BotBrainState;
  readonly chaseTarget: { x: number; z: number } | null;
  readonly aimYaw: number;
  readonly aimPitch: number;
  readonly wantsFire: boolean;
}

interface MutableBotBrainIntent {
  state: BotBrainState;
  chaseTarget: { x: number; z: number } | null;
  aimYaw: number;
  aimPitch: number;
  wantsFire: boolean;
}

export interface BotBrainFrame {
  readonly intent: BotBrainIntent;
  
  readonly stepped: boolean;
}

type MutableBotBrainFrame = {
  intent: MutableBotBrainIntent;
  stepped: boolean;
};

const BOT_BRAIN_ACCUMULATOR_CAP_S = BOT_BRAIN_STEP_S * 2;

export class BotBrain {
  #accumulator = 0;
  readonly #intent: MutableBotBrainIntent = {
    state: 'idle',
    chaseTarget: null,
    aimYaw: 0,
    aimPitch: 0,
    wantsFire: false
  };
  readonly #frameScratch: MutableBotBrainFrame = {
    intent: this.#intent,
    stepped: false
  };
  readonly #objectiveScratch: MutableBotObjective = {
    mode: 'push',
    goalX: 0,
    goalZ: 0,
    aimYaw: 0,
    aimPitch: 0,
    wantsFire: false
  };
  #modeLockRemaining = 0;

  reset(): void {
    this.#accumulator = 0;
    this.#setIdleIntent();
    this.#modeLockRemaining = 0;
  }

  update(deltaSeconds: number, sampleInput: () => BotBrainInput): BotBrainFrame {
    let stepped = false;
    this.#accumulator += deltaSeconds;
    if (this.#accumulator > BOT_BRAIN_ACCUMULATOR_CAP_S) {
      this.#accumulator = BOT_BRAIN_ACCUMULATOR_CAP_S;
    }
    while (this.#accumulator >= BOT_BRAIN_STEP_S) {
      this.#accumulator -= BOT_BRAIN_STEP_S;
      this.#think(sampleInput());
      stepped = true;
    }

    const frame = this.#frameScratch;
    frame.stepped = stepped;
    return frame as BotBrainFrame;
  }

  get intent(): BotBrainIntent {
    return this.#intent;
  }

  #setIdleIntent(): void {
    this.#intent.state = 'idle';
    this.#intent.chaseTarget = null;
    this.#intent.aimYaw = 0;
    this.#intent.aimPitch = 0;
    this.#intent.wantsFire = false;
  }

  #writeIntent(params: {
    state: BotBrainState;
    goalX: number;
    goalZ: number;
    aimYaw: number;
    aimPitch: number;
    wantsFire: boolean;
  }): void {
    this.#intent.state = params.state;
    if (this.#intent.chaseTarget === null) {
      this.#intent.chaseTarget = { x: params.goalX, z: params.goalZ };
    } else {
      this.#intent.chaseTarget.x = params.goalX;
      this.#intent.chaseTarget.z = params.goalZ;
    }
    this.#intent.aimYaw = params.aimYaw;
    this.#intent.aimPitch = params.aimPitch;
    this.#intent.wantsFire = params.wantsFire;
  }

  #think(input: BotBrainInput): void {
    if (input.isDead || !input.matchLive) {
      this.#modeLockRemaining = 0;
      this.#setIdleIntent();
      return;
    }

    const objective = this.#objectiveScratch;
    fillBotObjective(input, objective);
    const nextState = objective.mode;
    const prevState = this.#intent.state;

    if (nextState === 'fight') {
      this.#modeLockRemaining = MODE_LOCK_THINKS;
      this.#writeIntent({
        state: nextState,
        goalX: objective.goalX,
        goalZ: objective.goalZ,
        aimYaw: objective.aimYaw,
        aimPitch: objective.aimPitch,
        wantsFire: objective.wantsFire
      });
      return;
    }

    if (prevState === 'fight') {
      this.#modeLockRemaining = MODE_LOCK_THINKS;
      this.#writeIntent({
        state: nextState,
        goalX: objective.goalX,
        goalZ: objective.goalZ,
        aimYaw: objective.aimYaw,
        aimPitch: objective.aimPitch,
        wantsFire: objective.wantsFire
      });
      return;
    }

    if (input.target === null) {
      this.#modeLockRemaining = 0;
      this.#writeIntent({
        state: nextState,
        goalX: objective.goalX,
        goalZ: objective.goalZ,
        aimYaw: objective.aimYaw,
        aimPitch: objective.aimPitch,
        wantsFire: objective.wantsFire
      });
      return;
    }

    if (
      prevState !== 'idle' &&
      nextState !== prevState &&
      this.#modeLockRemaining > 0
    ) {
      this.#modeLockRemaining -= 1;
      this.#intent.state = prevState;
      this.#writeIntent({
        state: prevState,
        goalX: objective.goalX,
        goalZ: objective.goalZ,
        aimYaw: objective.aimYaw,
        aimPitch: objective.aimPitch,
        wantsFire: false
      });
      return;
    }

    if (nextState !== prevState) {
      this.#modeLockRemaining = MODE_LOCK_THINKS;
    } else if (this.#modeLockRemaining > 0) {
      this.#modeLockRemaining -= 1;
    }

    this.#writeIntent({
      state: nextState,
      goalX: objective.goalX,
      goalZ: objective.goalZ,
      aimYaw: objective.aimYaw,
      aimPitch: objective.aimPitch,
      wantsFire: objective.wantsFire
    });
  }
}
