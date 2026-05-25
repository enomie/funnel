import { PLAYER_CONFIG } from '../config/game-config';
import type { InputSnapshot } from '../input/input-state';

export type MovementKeys = InputSnapshot['movement'];

export interface MovementSpeedOptions {
  sprint: boolean;
  crouch: boolean;
}

/** Planar speed (m/s) from current input — matches `PlayerController` movement math. */
export function planarSpeedFromInput(
  movement: MovementKeys,
  options: MovementSpeedOptions
): number {
  const velocity = fillPlanarVelocityFromInput(movement, options, 0);
  return Math.hypot(velocity.x, velocity.z);
}

const _planarVelocityScratch = { x: 0, z: 0 };

/** World-space XZ velocity from WASD relative to yaw (m/s). */
export function fillPlanarVelocityFromInput(
  movement: MovementKeys,
  options: MovementSpeedOptions,
  yaw: number,
  out: { x: number; z: number } = _planarVelocityScratch
): { x: number; z: number } {
  const moveCount =
    Number(movement.forward) +
    Number(movement.back) +
    Number(movement.left) +
    Number(movement.right);

  if (moveCount === 0) {
    out.x = 0;
    out.z = 0;
    return out;
  }

  let speed: number =
    options.crouch
      ? PLAYER_CONFIG.crouchSpeed
      : options.sprint
        ? PLAYER_CONFIG.sprintSpeed
        : PLAYER_CONFIG.walkSpeed;

  if (moveCount === 2) {
    speed /= Math.sqrt(2);
  }

  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  let x = 0;
  let z = 0;

  if (movement.forward) {
    z += speed * cos;
    x += speed * sin;
  }

  if (movement.back) {
    z += -speed * cos;
    x += -speed * sin;
  }

  if (movement.left) {
    x += speed * cos;
    z += -speed * sin;
  }

  if (movement.right) {
    x += -speed * cos;
    z += speed * sin;
  }

  out.x = x;
  out.z = z;
  return out;
}

/** @deprecated Use `fillPlanarVelocityFromInput`. */
export function planarVelocityFromInput(
  movement: MovementKeys,
  options: MovementSpeedOptions,
  yaw: number
): { x: number; z: number } {
  return fillPlanarVelocityFromInput(movement, options, yaw, { x: 0, z: 0 });
}
