// Path: /Users/johann/MyBrew/funnel-real/src/player/player-stance.ts

import RAPIER from '@dimforge/rapier3d-simd-compat';
import type { RigidBody, World } from '@dimforge/rapier3d-simd-compat';
import { PLAYER_CONFIG } from '../config/game-config';
import { ACTOR_RAY_QUERY_GROUPS } from '../physics/collision-groups';

export const CROUCH_LOCOMOTION_CLIP_ID = 'crouch-idle';
export const STAND_LOCOMOTION_CLIP_ID = 'rifle-aiming-idle';


export interface StanceMeshAnchors {
  standFootY: number;
  crouchFootY: number;
}


export function crouchCapsuleHalfHeightM(): number {
  const cylindricalM = PLAYER_CONFIG.crouchCapsuleHeightM - PLAYER_CONFIG.radius * 2;
  return Math.max(0, cylindricalM * 0.5);
}

export function stanceHalfHeight(crouching: boolean): number {
  if (!crouching) {
    return PLAYER_CONFIG.halfHeight;
  }

  return crouchCapsuleHalfHeightM();
}


export function capsuleTotalHeightM(crouching: boolean): number {
  const total = stanceHalfHeight(crouching) * 2 + PLAYER_CONFIG.radius * 2;
  if (crouching) {
    return Math.min(total, PLAYER_CONFIG.crouchCapsuleHeightM);
  }

  return total;
}


export function groundYFromCapsuleCenter(centerY: number, crouching: boolean): number {
  return centerY - stanceHalfHeight(crouching) - PLAYER_CONFIG.radius;
}


export function capsuleBottomOffsetY(crouching: boolean): number {
  return -(stanceHalfHeight(crouching) + PLAYER_CONFIG.radius);
}


export function capsuleCenterYOnGround(groundY: number, crouching: boolean): number {
  return groundY + stanceHalfHeight(crouching) + PLAYER_CONFIG.radius;
}


export function characterMeshOffsetY(crouching: boolean, anchors: StanceMeshAnchors): number {
  const footY = crouching ? anchors.crouchFootY : anchors.standFootY;
  return capsuleBottomOffsetY(crouching) - footY;
}


export function characterMeshOffsetYFromFootY(crouching: boolean, footY: number): number {
  return capsuleBottomOffsetY(crouching) - footY;
}

let _snapGroundRay: RAPIER.Ray | null = null;

export function snapRigidBodyToGround(
  world: World,
  body: RigidBody,
  crouching: boolean
): boolean {
  const halfHeight = stanceHalfHeight(crouching);
  const radius = PLAYER_CONFIG.radius;
  const translation = body.translation();
  const rayOriginY = translation.y + halfHeight + radius + 0.08;
  if (_snapGroundRay === null) {
    _snapGroundRay = new RAPIER.Ray(
      { x: translation.x, y: rayOriginY, z: translation.z },
      { x: 0, y: -1, z: 0 }
    );
  } else {
    _snapGroundRay.origin.x = translation.x;
    _snapGroundRay.origin.y = rayOriginY;
    _snapGroundRay.origin.z = translation.z;
  }

  const maxToi = halfHeight * 2 + radius * 2 + 3;
  const hit = world.castRay(
    _snapGroundRay,
    maxToi,
    true,
    undefined,
    ACTOR_RAY_QUERY_GROUPS,
    undefined,
    body
  );

  if (hit === null) {
    return false;
  }

  const groundY = rayOriginY - hit.timeOfImpact;
  body.setTranslation(
    {
      x: translation.x,
      y: capsuleCenterYOnGround(groundY, crouching),
      z: translation.z
    },
    true
  );
  return true;
}

export function canEnterCrouch(input: { crouchHeld: boolean; grounded: boolean }): boolean {
  return input.crouchHeld && input.grounded;
}

export function shouldExitCrouch(input: { crouchHeld: boolean }): boolean {
  return !input.crouchHeld;
}
