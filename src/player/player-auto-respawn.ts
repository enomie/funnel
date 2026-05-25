/** Matchplay auto-respawn delay after player death (Revive/Hire may pause this later). */
export const PLAYER_AUTO_RESPAWN_SECONDS = 5;

export const PLAYER_AUTO_RESPAWN_MS = PLAYER_AUTO_RESPAWN_SECONDS * 1000;

export function playerAutoRespawnDueAtMs(diedAtMs: number): number {
  return diedAtMs + PLAYER_AUTO_RESPAWN_MS;
}

/** Whole seconds left until auto-respawn; `0` means respawn this frame. Requires a stamped `diedAtMs`. */
export function playerAutoRespawnCountdownSeconds(nowMs: number, diedAtMs: number): number {
  if (diedAtMs <= 0) {
    return 0;
  }

  const remainingMs = playerAutoRespawnDueAtMs(diedAtMs) - nowMs;
  return Math.max(0, Math.ceil(remainingMs / 1000));
}
