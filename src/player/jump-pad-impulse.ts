import { PLAYER_CONFIG } from '../config/game-config';
import { fillPlanarVelocityFromInput, type MovementKeys } from './player-movement-speed';
import {
  upwardVelocityForApex,
  type JumpImpulseResult,
  type JumpStyle
} from './player-jump';

/** UT99-style launch — high arc with strong carry toward center. */
export const JUMP_PAD_APEX_M = 30;
const JUMP_PAD_CENTER_THRUST_MPS = 16;
const JUMP_PAD_PLANAR_RETAIN = 0.8;
const JUMP_PAD_WISH_BLEND = 0.65;

/** Mega-jump off team flank pads — boost toward funnel center + movement carry. */
export function computeJumpPadImpulse(
  padX: number,
  padZ: number,
  yaw: number,
  movement: MovementKeys,
  linvel: { readonly x: number; readonly y: number; readonly z: number }
): JumpImpulseResult {
  let thrustX = -padX;
  let thrustZ = -padZ;
  const thrustLen = Math.hypot(thrustX, thrustZ);
  if (thrustLen > 0.001) {
    thrustX = (thrustX / thrustLen) * JUMP_PAD_CENTER_THRUST_MPS;
    thrustZ = (thrustZ / thrustLen) * JUMP_PAD_CENTER_THRUST_MPS;
  }

  const wish = fillPlanarVelocityFromInput(
    movement,
    { sprint: true, crouch: false },
    yaw
  );
  const wishLen = Math.hypot(wish.x, wish.z);
  if (wishLen > 0.001) {
    thrustX += wish.x * JUMP_PAD_WISH_BLEND;
    thrustZ += wish.z * JUMP_PAD_WISH_BLEND;
  }

  const style: JumpStyle = wishLen > 0.001 ? 'run' : 'walk';

  return {
    x: linvel.x * JUMP_PAD_PLANAR_RETAIN + thrustX,
    y: upwardVelocityForApex(JUMP_PAD_APEX_M),
    z: linvel.z * JUMP_PAD_PLANAR_RETAIN + thrustZ,
    style,
    airThrustWishX: 0,
    airThrustWishZ: 0
  };
}

/** Capsule vs axis-aligned jump-pad volume (walk-through trigger). */
export function capsuleIntersectsJumpPadVolume(
  actorX: number,
  actorY: number,
  actorZ: number,
  padCenterX: number,
  padCenterY: number,
  padCenterZ: number,
  padHalfX: number,
  padHalfY: number,
  padHalfZ: number
): boolean {
  const capsuleHalf = PLAYER_CONFIG.halfHeight + PLAYER_CONFIG.radius;
  const actorMinY = actorY - capsuleHalf;
  const actorMaxY = actorY + capsuleHalf;
  const padMinY = padCenterY - padHalfY;
  const padMaxY = padCenterY + padHalfY;

  if (actorMaxY < padMinY || actorMinY > padMaxY) {
    return false;
  }

  return (
    Math.abs(actorX - padCenterX) <= padHalfX + PLAYER_CONFIG.radius &&
    Math.abs(actorZ - padCenterZ) <= padHalfZ + PLAYER_CONFIG.radius
  );
}
