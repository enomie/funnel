// Path: /Users/johann/MyBrew/funnel-real/src/core/game-frame-clock.ts

import { PHYSICS_CONFIG } from '../config/game-config';
import { shouldAdvanceGameFrame } from '../platform/chrome-macos-arm-profile';


const MAX_FRAME_DELTA_S = 0.05;


const MAX_PHYSICS_REMAINDER_MULTIPLIER = 2;

export interface GameFrameTick {
  readonly deltaSeconds: number;
  readonly nowMs: number;
  readonly frameId: number;
}

export interface PhysicsStepBatch {
  readonly subSteps: number;
  readonly fixedStep: number;
}

type MutableGameFrameTick = {
  deltaSeconds: number;
  nowMs: number;
  frameId: number;
};

type MutablePhysicsStepBatch = {
  subSteps: number;
  fixedStep: number;
};


const FRAME_BUDGET_TIGHT_MS = 20;
const FRAME_BUDGET_CRITICAL_MS = 28;

export class GameFrameClock {
  #lastTickMs = performance.now();
  #physicsAccumulator = 0;
  #frameId = 0;
  readonly #physicsMaxSubSteps: number;
  #activeMaxSubSteps: number;
  readonly #maxPhysicsRemainderS: number;
  readonly #renderTick: MutableGameFrameTick = {
    deltaSeconds: 0,
    nowMs: 0,
    frameId: 0
  };
  readonly #physicsStepBatch: MutablePhysicsStepBatch = {
    subSteps: 0,
    fixedStep: PHYSICS_CONFIG.fixedStep
  };

  constructor(physicsMaxSubSteps: number) {
    this.#physicsMaxSubSteps = physicsMaxSubSteps;
    this.#activeMaxSubSteps = physicsMaxSubSteps;
    this.#maxPhysicsRemainderS =
      PHYSICS_CONFIG.fixedStep * MAX_PHYSICS_REMAINDER_MULTIPLIER;
    document.addEventListener('visibilitychange', this.#onVisibilityChange);
  }

  
  beginRenderFrame(nowMs: number): GameFrameTick | null {
    if (!shouldAdvanceGameFrame(nowMs, this.#lastTickMs)) {
      return null;
    }

    const deltaSeconds = Math.min((nowMs - this.#lastTickMs) / 1000, MAX_FRAME_DELTA_S);
    this.#lastTickMs = nowMs;
    this.#frameId += 1;

    const tick = this.#renderTick;
    tick.deltaSeconds = deltaSeconds;
    tick.nowMs = nowMs;
    tick.frameId = this.#frameId;
    return this.#renderTick as GameFrameTick;
  }

  
  recordFrameWallMs(wallMs: number): void {
    if (wallMs >= FRAME_BUDGET_CRITICAL_MS) {
      this.#activeMaxSubSteps = Math.max(2, this.#physicsMaxSubSteps - 2);
      return;
    }

    if (wallMs >= FRAME_BUDGET_TIGHT_MS) {
      this.#activeMaxSubSteps = Math.max(2, this.#physicsMaxSubSteps - 1);
      return;
    }

    this.#activeMaxSubSteps = this.#physicsMaxSubSteps;
  }

  
  accumulatePhysics(deltaSeconds: number): void {
    if (deltaSeconds <= 0) {
      return;
    }

    this.#physicsAccumulator = Math.min(
      this.#physicsAccumulator + deltaSeconds,
      PHYSICS_CONFIG.fixedStep * this.#activeMaxSubSteps
    );
  }

  
  consumePhysicsSteps(onStep: (fixedStep: number) => void): PhysicsStepBatch {
    const { fixedStep } = PHYSICS_CONFIG;
    let subSteps = 0;

    while (
      this.#physicsAccumulator >= fixedStep &&
      subSteps < this.#activeMaxSubSteps
    ) {
      onStep(fixedStep);
      this.#physicsAccumulator -= fixedStep;
      subSteps += 1;
    }

    if (
      subSteps === this.#activeMaxSubSteps &&
      this.#physicsAccumulator > this.#maxPhysicsRemainderS
    ) {
      this.#physicsAccumulator = this.#maxPhysicsRemainderS;
    }

    const batch = this.#physicsStepBatch;
    batch.subSteps = subSteps;
    batch.fixedStep = fixedStep;
    return batch as PhysicsStepBatch;
  }

  #onVisibilityChange = (): void => {
    this.#lastTickMs = performance.now();
    this.#physicsAccumulator = 0;
  };
}
