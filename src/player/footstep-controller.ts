import {
  fillFootstepOriginFromCapsule,
  playFootstepStepAt
} from '../game-audio/audio-one-shots/audio-footstep';
import { playFootstepLandAt } from '../game-audio/audio-one-shots/audio-footstep-landing';
import { speakGruntAt } from '../game-audio/audio-grunts/audio-grunt-tts';
import type { HumanoidRigId } from './humanoid-rig';
import {
  computeLocomotionTimeScale,
  isLocomotionClipWithFootsteps,
  locomotionGaitReferenceClipId,
  locomotionSyncSpeedMps,
  stepDistanceMeters
} from './locomotion-stride-sync';

const MIN_MOVE_SPEED_FOR_STEPS = 0.35;
const JUMP_GRUNT_TEXT = 'A';
const LAND_GRUNT_TEXT = 'uff';
const LAND_GRUNT_MIN_IMPACT_MPS = 2.5;

export interface FootstepFrameInput {
  readonly grounded: boolean;
  readonly landedFromAir: boolean;
  readonly landImpactMps: number;
  readonly isDead: boolean;
  readonly sprint: boolean;
  readonly crouch: boolean;
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly planarSpeedBody: number;
  readonly planarSpeedTarget: number;
  readonly locomotionClipId: string;
  readonly rigId?: HumanoidRigId;
}

export type MutableFootstepFrameInput = {
  grounded: boolean;
  landedFromAir: boolean;
  landImpactMps: number;
  isDead: boolean;
  sprint: boolean;
  crouch: boolean;
  position: { x: number; y: number; z: number };
  planarSpeedBody: number;
  planarSpeedTarget: number;
  locomotionClipId: string;
  rigId?: HumanoidRigId;
};

export class FootstepController {
  readonly #footOriginScratch = { x: 0, y: 0, z: 0 };
  readonly #lastPosition = { x: 0, y: 0, z: 0 };
  #lastPositionActive = false;
  #distanceSinceStep = 0;

  playJumpAt(
    capsuleCenter: { x: number; y: number; z: number },
    rigId?: HumanoidRigId
  ): void {
    if (rigId === undefined) {
      return;
    }

    void speakGruntAt(JUMP_GRUNT_TEXT, rigId, capsuleCenter);
  }

  update(input: FootstepFrameInput): void {
    const origin = fillFootstepOriginFromCapsule(
      input.position,
      input.crouch,
      this.#footOriginScratch
    );

    if (input.landedFromAir && !input.isDead) {
      playFootstepLandAt(origin);
      if (input.rigId !== undefined && input.landImpactMps >= LAND_GRUNT_MIN_IMPACT_MPS) {
        void speakGruntAt(LAND_GRUNT_TEXT, input.rigId, origin);
      }
      this.#distanceSinceStep = 0;
    }

    if (input.isDead || !input.grounded) {
      this.#syncLastPosition(input.position);
      this.#distanceSinceStep = 0;
      return;
    }

    const syncSpeed = locomotionSyncSpeedMps(input.planarSpeedBody, input.planarSpeedTarget);
    if (syncSpeed < MIN_MOVE_SPEED_FOR_STEPS) {
      this.#syncLastPosition(input.position);
      this.#distanceSinceStep = 0;
      return;
    }

    if (!isLocomotionClipWithFootsteps(input.locomotionClipId)) {
      this.#syncLastPosition(input.position);
      return;
    }

    if (!this.#lastPositionActive) {
      this.#syncLastPosition(input.position);
      return;
    }

    const dx = input.position.x - this.#lastPosition.x;
    const dz = input.position.z - this.#lastPosition.z;
    this.#syncLastPosition(input.position);

    const traveled = Math.hypot(dx, dz);
    if (traveled < 0.0001) {
      return;
    }

    const gaitClipId = locomotionGaitReferenceClipId(input.sprint);
    const timeScale = computeLocomotionTimeScale(gaitClipId, syncSpeed);
    const stepDistance = stepDistanceMeters(gaitClipId, syncSpeed, timeScale);

    this.#distanceSinceStep += traveled;

    if (this.#distanceSinceStep >= stepDistance) {
      this.#distanceSinceStep %= stepDistance;
      playFootstepStepAt(origin);
    }
  }

  #syncLastPosition(position: { x: number; y: number; z: number }): void {
    this.#lastPosition.x = position.x;
    this.#lastPosition.y = position.y;
    this.#lastPosition.z = position.z;
    this.#lastPositionActive = true;
  }
}
