import { PLAYER_CONFIG } from '../config/game-config';
import type { InputSnapshot } from '../input/input-state';

/** Planar speed (m/s) from current input — matches `PlayerController` movement math. */
export function planarSpeedFromInput(
  input: InputSnapshot,
  options: { sprint: boolean; crouch: boolean }
): number {
  const moveCount =
    Number(input.movement.forward) +
    Number(input.movement.back) +
    Number(input.movement.left) +
    Number(input.movement.right);

  if (moveCount === 0) {
    return 0;
  }

  let speed =
    options.sprint && !options.crouch ? PLAYER_CONFIG.sprintSpeed : PLAYER_CONFIG.walkSpeed;

  if (moveCount === 2) {
    speed /= Math.sqrt(2);
  }

  if (options.crouch) {
    speed /= 2;
  }

  return speed;
}
