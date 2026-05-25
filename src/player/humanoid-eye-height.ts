import { PLAYER_CONFIG } from '../config/game-config';

/** Capsule-center → eye pivot offsets (m) — tuned on Y/X-Bot idle/crouch/death clips. */
export const HUMANOID_EYE_HEIGHT_OFFSET = {
  stand: PLAYER_CONFIG.cameraHeight,
  crouch: PLAYER_CONFIG.crouchCameraHeight,
  death: PLAYER_CONFIG.deathCameraHeight
} as const;

export function eyeHeightOffsetFromCapsule(flags: {
  readonly isDead?: boolean;
  readonly crouching?: boolean;
}): number {
  if (flags.isDead === true) {
    return HUMANOID_EYE_HEIGHT_OFFSET.death;
  }
  if (flags.crouching === true) {
    return HUMANOID_EYE_HEIGHT_OFFSET.crouch;
  }
  return HUMANOID_EYE_HEIGHT_OFFSET.stand;
}
