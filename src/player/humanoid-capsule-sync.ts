// Path: /Users/johann/MyBrew/funnel-real/src/player/humanoid-capsule-sync.ts

import type { Collider, RigidBody } from '@dimforge/rapier3d-simd-compat';
import {
  capsuleCenterYOnGround,
  crouchCapsuleHalfHeightM,
  groundYFromCapsuleCenter,
  stanceHalfHeight
} from './player-stance';


export type HumanoidCapsuleMode = 'stand' | 'crouch';

const CROUCH_MODE: HumanoidCapsuleMode = 'crouch';
const STAND_MODE: HumanoidCapsuleMode = 'stand';

export function resolveCapsuleMode(flags: {
  readonly isDead?: boolean;
  readonly crouch?: boolean;
  readonly sliding?: boolean;
}): HumanoidCapsuleMode {
  if (flags.isDead === true || flags.crouch === true || flags.sliding === true) {
    return CROUCH_MODE;
  }

  return STAND_MODE;
}

export function inferCapsuleModeFromCollider(collider: Collider): HumanoidCapsuleMode {
  return collider.halfHeight() <= crouchCapsuleHalfHeightM() + 1e-4 ? CROUCH_MODE : STAND_MODE;
}

export function meshUsesCrouchCapsule(isDead: boolean, crouching: boolean): boolean {
  return resolveCapsuleMode({ isDead, crouch: crouching }) === CROUCH_MODE;
}

export function applyCapsuleMode(collider: Collider, mode: HumanoidCapsuleMode): void {
  collider.setHalfHeight(stanceHalfHeight(mode === CROUCH_MODE));
}

export function inferGroundYFromBody(body: RigidBody, mode: HumanoidCapsuleMode): number {
  const translation = body.translation();
  return groundYFromCapsuleCenter(translation.y, mode === CROUCH_MODE);
}

export function pinBodyCapsuleToGround(
  body: RigidBody,
  groundY: number,
  mode: HumanoidCapsuleMode
): void {
  const translation = body.translation();
  const targetY = capsuleCenterYOnGround(groundY, mode === CROUCH_MODE);
  if (Math.abs(translation.y - targetY) <= 1e-5) {
    return;
  }

  body.setTranslation(
    { x: translation.x, y: targetY, z: translation.z },
    true
  );
}


export function transitionCapsuleOnGround(params: {
  readonly collider: Collider;
  readonly body: RigidBody;
  readonly toMode: HumanoidCapsuleMode;
  readonly groundY: number;
}): void {
  applyCapsuleMode(params.collider, params.toMode);
  pinBodyCapsuleToGround(params.body, params.groundY, params.toMode);
}

export function freezeBodyOnGround(body: RigidBody): void {
  body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  body.setAngvel({ x: 0, y: 0, z: 0 }, true);
}
