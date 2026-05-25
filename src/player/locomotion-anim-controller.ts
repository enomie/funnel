import {
  AnimationAction,
  LoopOnce,
  LoopRepeat,
  type AnimationMixer
} from 'three/webgpu';
import type { AnimationClipRegistry } from './animation-clip-registry';
import { resolveLocomotionBlendInto, type LocomotionBlendResult, type LocomotionBlendRole } from './locomotion-blend';
import {
  advanceLocomotionPhase,
  locomotionGaitReferenceClipId,
  locomotionSyncSpeedMps
} from './locomotion-stride-sync';
import { CROUCH_LOCOMOTION_CLIP_ID } from './player-stance';
import type { JumpStyle } from './player-jump';
import { VERTICAL_JUMP_SUBCLIP_IDS } from './vertical-jump-subclips';

const CROSSFADE_LOCOMOTION = 0.15;
const CROSSFADE_CROUCH = 0.1;
const CROSSFADE_FAST = 0.05;
const FIRE_OVERLAY_FADE_OUT = 0.06;
const FIRE_OVERLAY_WEIGHT_IDLE = 1;
const FIRE_OVERLAY_WEIGHT_MOVING = 0.72;

const JUMP_CLIP_TIMESCALE: Record<JumpStyle, number> = {
  idle: 0.88,
  walk: 1.05,
  run: 1.28,
  backward: 1
};

const CROSSFADE_LAND = 0.16;

const LAND_CLIP_TIMESCALE: Record<JumpStyle, number> = {
  idle: 1,
  walk: 1.12,
  run: 1.22,
  backward: 1.08
};

const LAND_BLEND_OUT_IDLE_FULL = 0.9;
const LAND_BLEND_OUT_MOVING = 0.46;

const ONE_SHOT_CLIPS = new Set([
  'jump-forward',
  'jump-backward',
  'jump-up-takeoff',
  'jump-down-land',
  'firing-rifle',
  'walking-to-dying'
]);

const CLIP = {
  idle: 'rifle-aiming-idle',
  jumpForward: 'jump-forward',
  jumpBackward: 'jump-backward',
  fire: 'firing-rifle',
  death: 'walking-to-dying',
  crouchIdle: CROUCH_LOCOMOTION_CLIP_ID
} as const;

const HARD_SWITCH_LOCOMOTION_CLIPS: Set<string> = new Set([
  CLIP.jumpForward,
  CLIP.jumpBackward,
  CLIP.death,
  VERTICAL_JUMP_SUBCLIP_IDS.takeoff
]);

type BlendLayerSlot = {
  action: AnimationAction;
  clipId: string;
  clipDuration: number;
};

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
  planarSpeedBody: number;
  planarSpeedTarget: number;
  jumpStyle: JumpStyle;
  landedFromAir: boolean;
}

type LocomotionAnimInputParams = Omit<LocomotionAnimInput, 'crouch' | 'sliding'> &
  Partial<Pick<LocomotionAnimInput, 'crouch' | 'sliding'>>;

/** Fills `out` in place — no allocation on hot path. */
export function buildLocomotionAnimInputInto(
  out: LocomotionAnimInput,
  params: LocomotionAnimInputParams
): LocomotionAnimInput {
  out.movement = params.movement;
  out.sprint = params.sprint;
  out.grounded = params.grounded;
  out.airborne = params.airborne;
  out.crouch = params.crouch ?? false;
  out.sliding = params.sliding ?? false;
  out.fireStarted = params.fireStarted;
  out.isDead = params.isDead;
  out.planarSpeedBody = params.planarSpeedBody;
  out.planarSpeedTarget = params.planarSpeedTarget;
  out.jumpStyle = params.jumpStyle;
  out.landedFromAir = params.landedFromAir;
  return out;
}

/** Shared player + bot locomotion payload — `crouch` / `sliding` default to false. */
export function buildLocomotionAnimInput(params: LocomotionAnimInputParams): LocomotionAnimInput {
  return buildLocomotionAnimInputInto(
    {
      movement: params.movement,
      sprint: params.sprint,
      grounded: params.grounded,
      airborne: params.airborne,
      crouch: false,
      sliding: false,
      fireStarted: params.fireStarted,
      isDead: params.isDead,
      planarSpeedBody: params.planarSpeedBody,
      planarSpeedTarget: params.planarSpeedTarget,
      jumpStyle: params.jumpStyle,
      landedFromAir: params.landedFromAir
    },
    params
  );
}

export class LocomotionAnimController {
  readonly #registry: AnimationClipRegistry;
  readonly #mixer: AnimationMixer;
  /** Single-clip path: idle, airborne, land, crouch, death. */
  #locomotion: AnimationAction | null = null;
  #locomotionClipId: string = CLIP.idle;
  readonly #blendLayers = new Map<LocomotionBlendRole, BlendLayerSlot>();
  #dominantBlendClipId: string = CLIP.idle;
  readonly #blendScratch: LocomotionBlendResult = { idle: true, layers: [], dominantClipId: CLIP.idle };
  /** Shared 0–1 footfall phase for all blend-space layers (Unreal-style sync). */
  #locomotionPhase = 0;
  #overlay: AnimationAction | null = null;
  #jumpPlayedThisAirborne = false;
  #deathPoseSettled = false;

  readonly #handleFinished = (event: { action: AnimationAction }): void => {
    if (event.action === this.#overlay) {
      this.#overlay = null;
    }
  };

  constructor(registry: AnimationClipRegistry, mixer: AnimationMixer) {
    this.#registry = registry;
    this.#mixer = mixer;
    this.#mixer.addEventListener('finished', this.#handleFinished);
    this.#playLocomotionClip(CLIP.idle, { immediate: true });
  }

  update(deltaSeconds: number, input: LocomotionAnimInput): void {
    this.#pauseBlendLayerClocks();

    if (input.isDead && this.#deathPoseSettled) {
      return;
    }

    this.#mixer.update(deltaSeconds);

    if (!input.airborne) {
      this.#jumpPlayedThisAirborne = false;
    }

    if (input.isDead) {
      this.#fadeOutOverlay();
      if (this.#locomotionClipId !== CLIP.death) {
        this.#deathPoseSettled = false;
        this.#stopBlendLayers();
        this.#playLocomotionClip(
          this.#registry.hasClip(CLIP.death) ? CLIP.death : CLIP.idle,
          { once: true, immediate: true }
        );
      } else if (this.#locomotion !== null) {
        this.#locomotion.timeScale = 1;
        if (!this.#locomotion.isRunning()) {
          this.#deathPoseSettled = true;
        }
      }
      return;
    }

    this.#deathPoseSettled = false;

    if (input.airborne) {
      this.#updateAirborne(input);
      this.#syncExclusiveTimeScale(input);
      return;
    }

    if (input.fireStarted) {
      this.#playFireOverlay(this.#syncSpeed(input) > 0.15);
    }

    if (input.crouch || input.sliding) {
      this.#clearBlendLayers();
      this.#playCrouchStance();
      this.#syncExclusiveTimeScale(input);
      return;
    }

    this.#updateGround(deltaSeconds, input);
  }

  get currentClipId(): string {
    if (this.#blendLayers.size > 0) {
      return this.#dominantBlendClipId;
    }

    return this.#locomotionClipId;
  }

  /** Death clip finished — mixer frozen; skip mesh/eye sync on visual pass. */
  get deathPoseSettled(): boolean {
    return this.#deathPoseSettled;
  }

  /** After bot respawn — leave death pose and return to idle locomotion. */
  reviveToIdle(): void {
    this.#deathPoseSettled = false;
    this.#fadeOutOverlay();
    this.#clearBlendLayers();
    this.#jumpPlayedThisAirborne = false;
    this.#playLocomotionClip(CLIP.idle, { immediate: true });
  }

  #updateAirborne(input: LocomotionAnimInput): void {
    this.#clearBlendLayers();
    const takeoffClipId = this.#takeoffClipId(input);

    if (!this.#jumpPlayedThisAirborne) {
      this.#jumpPlayedThisAirborne = true;
      this.#playLocomotionClip(takeoffClipId, { once: true, immediate: true });
      this.#applyJumpClipTimeScale(input.jumpStyle);
      return;
    }

    const takeoffStillPlaying =
      this.#locomotionClipId === takeoffClipId &&
      this.#locomotion !== null &&
      this.#locomotion.isRunning();

    if (takeoffStillPlaying) {
      return;
    }

    if (this.#locomotionClipId === CLIP.idle && this.#locomotion?.isRunning()) {
      return;
    }

    this.#playLocomotionClip(CLIP.idle, { fade: CROSSFADE_LOCOMOTION });
  }

  #takeoffClipId(input: LocomotionAnimInput): string {
    if (input.movement.back && !input.movement.forward && this.#registry.hasClip(CLIP.jumpBackward)) {
      return CLIP.jumpBackward;
    }

    if (input.movement.forward && this.#registry.hasClip(CLIP.jumpForward)) {
      return CLIP.jumpForward;
    }

    if (this.#registry.hasClip(VERTICAL_JUMP_SUBCLIP_IDS.takeoff)) {
      return VERTICAL_JUMP_SUBCLIP_IDS.takeoff;
    }

    return this.#registry.hasClip(CLIP.jumpForward) ? CLIP.jumpForward : CLIP.idle;
  }

  #updateGround(deltaSeconds: number, input: LocomotionAnimInput): void {
    if (this.#registry.hasClip(VERTICAL_JUMP_SUBCLIP_IDS.land)) {
      if (input.landedFromAir) {
        this.#clearBlendLayers();
        this.#locomotionPhase = 0;
        this.#playLocomotionClip(VERTICAL_JUMP_SUBCLIP_IDS.land, {
          once: true,
          fade: CROSSFADE_LAND
        });
        return;
      }

      if (this.#locomotionClipId === VERTICAL_JUMP_SUBCLIP_IDS.land) {
        if (this.#locomotion?.isRunning() && !this.#shouldBlendOutOfLand(input)) {
          return;
        }

        if (this.#locomotion !== null && this.#locomotion.getEffectiveWeight() > 0.01) {
          this.#fadeOutExclusiveLocomotion();
        }
      }
    }

    const blend = resolveLocomotionBlendInto(this.#blendScratch, {
      movement: input.movement,
      sprint: input.sprint
    });

    if (blend.idle) {
      this.#clearBlendLayers();
      this.#locomotionPhase = 0;
      this.#playLocomotionClip(CLIP.idle, { fade: CROSSFADE_LOCOMOTION });
      return;
    }

    this.#dominantBlendClipId = blend.dominantClipId;

    for (const role of ['forward', 'strafe'] as const) {
      let layer: (typeof blend.layers)[number] | undefined;
      for (let index = 0; index < blend.layers.length; index += 1) {
        if (blend.layers[index].role === role) {
          layer = blend.layers[index];
          break;
        }
      }
      if (layer === undefined) {
        this.#fadeOutBlendLayer(role);
        continue;
      }

      this.#setBlendLayer(role, layer.clipId, layer.weight);
    }

    const syncSpeed = this.#syncSpeed(input);
    this.#locomotionPhase = advanceLocomotionPhase(
      this.#locomotionPhase,
      syncSpeed,
      locomotionGaitReferenceClipId(input.sprint),
      deltaSeconds
    );
    this.#applyLocomotionPhase();
  }

  #setBlendLayer(role: LocomotionBlendRole, clipId: string, weight: number): void {
    const action = this.#registry.getAction(clipId);
    if (action === undefined) {
      return;
    }

    const existing = this.#blendLayers.get(role);
    if (existing !== undefined && existing.clipId === clipId) {
      existing.action.enabled = true;
      existing.action.setEffectiveWeight(weight);
      return;
    }

    const isFirstBlendLayer = this.#blendLayers.size === 0;
    const handoffAction =
      isFirstBlendLayer &&
      this.#locomotion !== null &&
      this.#locomotion.getEffectiveWeight() > 0.01
        ? this.#locomotion
        : null;

    if (existing !== undefined) {
      existing.action.fadeOut(CROSSFADE_LOCOMOTION);
      this.#blendLayers.delete(role);
    }

    action.setLoop(LoopRepeat, Infinity);
    action.clampWhenFinished = false;
    action.enabled = true;
    action.timeScale = 0;
    action.setEffectiveWeight(weight);
    action.play();

    if (handoffAction !== null) {
      action.crossFadeFrom(handoffAction, CROSSFADE_LOCOMOTION, true);
      this.#locomotion = null;
      this.#locomotionClipId = CLIP.idle;
    }

    this.#blendLayers.set(role, {
      action,
      clipId,
      clipDuration: this.#registry.getClip(clipId)?.duration ?? 1
    });
  }

  #fadeOutBlendLayer(role: LocomotionBlendRole): void {
    const slot = this.#blendLayers.get(role);
    if (slot === undefined) {
      return;
    }

    slot.action.fadeOut(CROSSFADE_LOCOMOTION);
    this.#blendLayers.delete(role);
  }

  #clearBlendLayers(): void {
    for (const role of ['forward', 'strafe'] as const) {
      this.#fadeOutBlendLayer(role);
    }
  }

  #stopBlendLayers(): void {
    for (const slot of this.#blendLayers.values()) {
      slot.action.stop();
      slot.action.enabled = false;
    }
    this.#blendLayers.clear();
  }

  #pauseBlendLayerClocks(): void {
    for (const slot of this.#blendLayers.values()) {
      slot.action.timeScale = 0;
    }
  }

  #applyLocomotionPhase(): void {
    for (const slot of this.#blendLayers.values()) {
      if (slot.clipDuration <= 0) {
        continue;
      }

      slot.action.time = this.#locomotionPhase * slot.clipDuration;
    }
  }

  #fadeOutExclusiveLocomotion(): void {
    if (this.#locomotion === null) {
      return;
    }

    this.#locomotion.fadeOut(CROSSFADE_LOCOMOTION);
    this.#locomotion = null;
    this.#locomotionClipId = CLIP.idle;
  }

  #playCrouchStance(): void {
    const clipId = this.#registry.hasClip(CLIP.crouchIdle) ? CLIP.crouchIdle : CLIP.idle;
    if (
      this.#locomotionClipId === clipId &&
      this.#locomotion !== null &&
      this.#locomotion.isRunning()
    ) {
      return;
    }

    this.#playLocomotionClip(clipId, { fade: CROSSFADE_CROUCH });
    if (this.#locomotion !== null) {
      this.#locomotion.timeScale = 1;
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
    this.#clearBlendLayers();
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

    const hardSwitch =
      options.immediate === true || HARD_SWITCH_LOCOMOTION_CLIPS.has(clipId);
    if (hardSwitch) {
      this.#stopLocomotionAction();
    }

    const once = options.once ?? ONE_SHOT_CLIPS.has(clipId);
    action.reset();
    action.setLoop(once ? LoopOnce : LoopRepeat, once ? 1 : Infinity);
    action.clampWhenFinished = once;
    action.enabled = true;
    action.setEffectiveWeight(1);
    action.timeScale = 1;
    action.play();

    if (this.#locomotion !== null && !hardSwitch) {
      this.#locomotion.crossFadeTo(action, options.fade ?? CROSSFADE_LOCOMOTION, true);
    }

    this.#locomotion = action;
    this.#locomotionClipId = clipId;
  }

  #stopLocomotionAction(): void {
    if (this.#locomotion === null) {
      return;
    }

    this.#locomotion.stop();
    this.#locomotion.setEffectiveWeight(0);
    this.#locomotion.enabled = false;
  }

  #syncSpeed(input: LocomotionAnimInput): number {
    return locomotionSyncSpeedMps(input.planarSpeedBody, input.planarSpeedTarget);
  }

  #syncExclusiveTimeScale(input: LocomotionAnimInput): void {
    if (this.#locomotion === null) {
      return;
    }

    if (
      this.#locomotionClipId === CLIP.jumpForward ||
      this.#locomotionClipId === CLIP.jumpBackward ||
      this.#locomotionClipId === VERTICAL_JUMP_SUBCLIP_IDS.takeoff
    ) {
      this.#applyJumpClipTimeScale(input.jumpStyle);
      return;
    }

    if (this.#locomotionClipId === VERTICAL_JUMP_SUBCLIP_IDS.land) {
      this.#locomotion.timeScale = LAND_CLIP_TIMESCALE[input.jumpStyle];
      return;
    }

    this.#locomotion.timeScale = 1;
  }

  #applyJumpClipTimeScale(style: JumpStyle): void {
    if (this.#locomotion === null) {
      return;
    }

    this.#locomotion.timeScale = JUMP_CLIP_TIMESCALE[style];
  }

  #shouldBlendOutOfLand(input: LocomotionAnimInput): boolean {
    if (this.#locomotion === null || this.#locomotionClipId !== VERTICAL_JUMP_SUBCLIP_IDS.land) {
      return true;
    }

    const clip = this.#registry.getClip(VERTICAL_JUMP_SUBCLIP_IDS.land);
    if (clip === undefined || clip.duration <= 0) {
      return true;
    }

    const progress = this.#locomotion.time / clip.duration;
    if (progress >= 0.98) {
      return true;
    }

    const moving =
      input.movement.forward ||
      input.movement.back ||
      input.movement.left ||
      input.movement.right;
    const movingJump = input.jumpStyle === 'run' || input.jumpStyle === 'walk';

    if (movingJump || moving) {
      return progress >= LAND_BLEND_OUT_MOVING;
    }

    return progress >= LAND_BLEND_OUT_IDLE_FULL;
  }
}
