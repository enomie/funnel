import {
  AnimationAction,
  LoopOnce,
  LoopRepeat,
  type AnimationMixer
} from 'three/webgpu';
import type { AnimationClipRegistry } from './animation-clip-registry';

const CROSSFADE_LOCOMOTION = 0.12;
const CROSSFADE_TRANSITION = 0.08;
const CROSSFADE_FAST = 0.05;
const FIRE_OVERLAY_FADE_OUT = 0.06;
const FIRE_OVERLAY_WEIGHT_IDLE = 1;
const FIRE_OVERLAY_WEIGHT_MOVING = 0.72;
const TIMESCALE_MIN = 0.55;
const TIMESCALE_MAX = 1.65;

/** Tuned in-game: m/s the clip visually matches at timeScale 1. */
const CLIP_REFERENCE_SPEED_MPS: Partial<Record<string, number>> = {
  walking: 1.35,
  'rifle-run': 5.2,
  'walking-backwards': 1.2,
  'run-backwards': 4.5,
  strafe: 1.3,
  'strafe-2': 1.3
};

const ONE_SHOT_CLIPS = new Set([
  'start-walking',
  'stop-walking',
  'start-walking-backwards',
  'walk-backwards-stop',
  'jump-forward',
  'jump-backward',
  'firing-rifle',
  'walking-to-dying'
]);

/** Strafe clips swapped: A = strafe-2, D = strafe (matches in-game strafe direction). */
const CLIP = {
  idle: 'rifle-aiming-idle',
  forwardWalk: 'walking',
  forwardRun: 'rifle-run',
  backwardWalk: 'walking-backwards',
  backwardRun: 'run-backwards',
  strafeLeft: 'strafe-2',
  strafeRight: 'strafe',
  jumpForward: 'jump-forward',
  jumpBackward: 'jump-backward',
  fire: 'firing-rifle',
  death: 'walking-to-dying',
  forwardStart: 'start-walking',
  forwardStop: 'stop-walking',
  backwardStart: 'start-walking-backwards',
  backwardStop: 'walk-backwards-stop'
} as const;

export interface LocomotionAnimInput {
  movement: {
    forward: boolean;
    back: boolean;
    left: boolean;
    right: boolean;
  };
  sprint: boolean;
  grounded: boolean;
  airborne: boolean;
  crouch: boolean;
  sliding: boolean;
  fireStarted: boolean;
  isDead: boolean;
  /** Horizontal capsule speed (m/s) for walk/run timeScale sync. */
  planarSpeed: number;
}

type LocomotionIntent =
  | 'idle'
  | 'forwardWalk'
  | 'forwardRun'
  | 'backwardWalk'
  | 'backwardRun'
  | 'strafeLeft'
  | 'strafeRight'
  | 'jumpForward'
  | 'jumpBackward'
  | 'fire'
  | 'death';

type TransitionKind = 'none' | 'forwardStart' | 'forwardStop' | 'backwardStart' | 'backwardStop';

export class LocomotionAnimController {
  readonly #registry: AnimationClipRegistry;
  readonly #mixer: AnimationMixer;
  #locomotion: AnimationAction | null = null;
  #locomotionClipId: string = CLIP.idle;
  #overlay: AnimationAction | null = null;
  #lastIntent: LocomotionIntent = 'idle';
  #transition: TransitionKind = 'none';
  #jumpPlayedThisAirborne = false;

  readonly #handleFinished = (event: { action: AnimationAction }): void => {
    if (event.action === this.#overlay) {
      this.#overlay = null;
      return;
    }

    if (event.action !== this.#locomotion) {
      return;
    }

    if (this.#transition === 'forwardStart') {
      this.#transition = 'none';
      this.#playLocomotionClip(CLIP.forwardWalk, { fade: CROSSFADE_TRANSITION });
      return;
    }

    if (this.#transition === 'forwardStop') {
      this.#transition = 'none';
      this.#playLocomotionClip(CLIP.idle, { fade: CROSSFADE_LOCOMOTION });
      return;
    }

    if (this.#transition === 'backwardStart') {
      this.#transition = 'none';
      this.#playLocomotionClip(CLIP.backwardWalk, { fade: CROSSFADE_TRANSITION });
      return;
    }

    if (this.#transition === 'backwardStop') {
      this.#transition = 'none';
      this.#playLocomotionClip(CLIP.idle, { fade: CROSSFADE_LOCOMOTION });
    }
  };

  constructor(registry: AnimationClipRegistry, mixer: AnimationMixer) {
    this.#registry = registry;
    this.#mixer = mixer;
    this.#mixer.addEventListener('finished', this.#handleFinished);
    this.#playLocomotionClip(CLIP.idle, { immediate: true });
  }

  update(deltaSeconds: number, input: LocomotionAnimInput): void {
    this.#mixer.update(deltaSeconds);

    if (!input.airborne) {
      this.#jumpPlayedThisAirborne = false;
    }

    if (input.isDead) {
      this.#fadeOutOverlay();
      this.#transition = 'none';
      if (this.#locomotionClipId !== CLIP.death) {
        this.#playLocomotionClip(
          this.#registry.hasClip(CLIP.death) ? CLIP.death : CLIP.idle,
          { once: true, fade: CROSSFADE_FAST }
        );
      }
      return;
    }

    if (input.airborne) {
      this.#transition = 'none';
      this.#updateAirborne(input);
      this.#syncLocomotionTimeScale(input);
      return;
    }

    if (input.fireStarted) {
      this.#playFireOverlay(input.planarSpeed > 0.15);
    }

    if (input.crouch || input.sliding) {
      this.#transition = 'none';
      this.#playIntent('idle');
      return;
    }

    if (this.#transition !== 'none') {
      const intent = this.#resolveIntent(input);
      if (this.#shouldInterruptTransition(intent)) {
        this.#transition = 'none';
        this.#playIntent(intent);
      }
      return;
    }

    this.#updateGround(input);
    this.#syncLocomotionTimeScale(input);
  }

  get currentClipId(): string {
    return this.#locomotionClipId;
  }

  #shouldInterruptTransition(intent: LocomotionIntent): boolean {
    if (this.#transition === 'forwardStart' || this.#transition === 'forwardStop') {
      return intent === 'forwardRun' || intent === 'strafeLeft' || intent === 'strafeRight';
    }

    if (this.#transition === 'backwardStart' || this.#transition === 'backwardStop') {
      return intent === 'backwardRun' || intent === 'strafeLeft' || intent === 'strafeRight';
    }

    return false;
  }

  #updateAirborne(input: LocomotionAnimInput): void {
    const intent = this.#resolveIntent(input);
    const jumpClipId = intent === 'jumpBackward' ? CLIP.jumpBackward : CLIP.jumpForward;

    if (!this.#jumpPlayedThisAirborne) {
      this.#lastIntent = intent;
      this.#jumpPlayedThisAirborne = true;
      this.#playLocomotionClip(jumpClipId, { once: true, fade: CROSSFADE_FAST });
      return;
    }

    const jumpStillPlaying =
      this.#locomotionClipId === jumpClipId && this.#locomotion !== null && this.#locomotion.isRunning();

    if (jumpStillPlaying) {
      return;
    }

    const fallClipId = this.#clipForIntent(intent === 'idle' ? 'idle' : intent);
    if (this.#locomotionClipId === fallClipId && this.#locomotion?.isRunning()) {
      return;
    }

    this.#lastIntent = intent;
    this.#playLocomotionClip(fallClipId, { fade: CROSSFADE_LOCOMOTION });
  }

  #updateGround(input: LocomotionAnimInput): void {
    const intent = this.#resolveIntent(input);
    this.#playIntent(intent);
  }

  #playIntent(intent: LocomotionIntent): void {
    const clipId = this.#clipForIntent(intent);
    if (
      this.#lastIntent === intent &&
      this.#locomotionClipId === clipId &&
      this.#locomotion !== null &&
      this.#locomotion.isRunning()
    ) {
      return;
    }

    this.#lastIntent = intent;
    this.#playLocomotionClip(clipId, { fade: CROSSFADE_LOCOMOTION });
  }

  #resolveIntent(input: LocomotionAnimInput): LocomotionIntent {
    if (input.isDead) {
      return 'death';
    }

    if (input.airborne) {
      if (input.movement.forward) {
        return 'jumpForward';
      }

      if (input.movement.back) {
        return 'jumpBackward';
      }

      return 'jumpForward';
    }

    if (input.movement.forward) {
      return input.sprint ? 'forwardRun' : 'forwardWalk';
    }

    if (input.movement.back) {
      return input.sprint ? 'backwardRun' : 'backwardWalk';
    }

    if (input.movement.left && !input.movement.right) {
      return 'strafeLeft';
    }

    if (input.movement.right && !input.movement.left) {
      return 'strafeRight';
    }

    return 'idle';
  }

  #clipForIntent(intent: LocomotionIntent): string {
    switch (intent) {
      case 'idle':
        return CLIP.idle;
      case 'forwardWalk':
        return CLIP.forwardWalk;
      case 'forwardRun':
        return CLIP.forwardRun;
      case 'backwardWalk':
        return CLIP.backwardWalk;
      case 'backwardRun':
        return CLIP.backwardRun;
      case 'strafeLeft':
        return CLIP.strafeLeft;
      case 'strafeRight':
        return CLIP.strafeRight;
      case 'jumpForward':
        return CLIP.jumpForward;
      case 'jumpBackward':
        return CLIP.jumpBackward;
      case 'fire':
        return CLIP.fire;
      case 'death':
        return CLIP.death;
    }
  }

  #playFireOverlay(moving: boolean): void {
    const action = this.#registry.getAction(CLIP.fire);
    if (action === undefined) {
      return;
    }

    const weight = moving ? FIRE_OVERLAY_WEIGHT_MOVING : FIRE_OVERLAY_WEIGHT_IDLE;

    action.reset();
    action.setLoop(LoopOnce, 1);
    action.clampWhenFinished = true;
    action.enabled = true;
    action.setEffectiveWeight(weight);
    action.play();

    if (this.#overlay !== null && this.#overlay !== action) {
      this.#overlay.fadeOut(CROSSFADE_FAST);
    }

    this.#overlay = action;
  }

  #fadeOutOverlay(): void {
    if (this.#overlay === null) {
      return;
    }

    this.#overlay.fadeOut(FIRE_OVERLAY_FADE_OUT);
    this.#overlay = null;
  }

  #playLocomotionClip(
    clipId: string,
    options: { fade?: number; once?: boolean; immediate?: boolean } = {}
  ): void {
    const action = this.#registry.getAction(clipId);
    if (action === undefined) {
      return;
    }

    if (
      action === this.#locomotion &&
      action.isRunning() &&
      this.#locomotionClipId === clipId
    ) {
      return;
    }

    const once = options.once ?? ONE_SHOT_CLIPS.has(clipId);
    action.reset();
    action.setLoop(once ? LoopOnce : LoopRepeat, once ? 1 : Infinity);
    action.clampWhenFinished = once;
    action.enabled = true;
    action.setEffectiveWeight(1);
    action.play();

    if (this.#locomotion !== null && !options.immediate) {
      this.#locomotion.crossFadeTo(action, options.fade ?? CROSSFADE_LOCOMOTION, true);
    }

    this.#locomotion = action;
    this.#locomotionClipId = clipId;
  }

  #syncLocomotionTimeScale(input: LocomotionAnimInput): void {
    if (this.#locomotion === null) {
      return;
    }

    const reference = CLIP_REFERENCE_SPEED_MPS[this.#locomotionClipId];
    if (reference === undefined || reference <= 0) {
      this.#locomotion.timeScale = 1;
      return;
    }

    const speed = Math.max(input.planarSpeed, reference * TIMESCALE_MIN);
    const scale = speed / reference;
    this.#locomotion.timeScale = Math.min(TIMESCALE_MAX, Math.max(TIMESCALE_MIN, scale));
  }
}
