/** Seconds after death before a bot respawns at its spawn pocket. */
export const BOT_RESPAWN_DELAY_S = 4;

export const BOT_RESPAWN_DELAY_MS = BOT_RESPAWN_DELAY_S * 1000;

/** Spread simultaneous deaths across this window (s) via roster slot — avoids respawn herds. */
export const BOT_RESPAWN_STAGGER_WINDOW_S = 2.5;

export function botRespawnDueAtMs(
  deathTimeMs: number,
  phaseSlot: number,
  phaseSlotCount: number
): number {
  if (deathTimeMs <= 0) {
    return Infinity;
  }

  const slots = Math.max(1, phaseSlotCount);
  const slot = ((phaseSlot % slots) + slots) % slots;
  const staggerMs = (slot / slots) * BOT_RESPAWN_STAGGER_WINDOW_S * 1000;
  return deathTimeMs + BOT_RESPAWN_DELAY_MS + staggerMs;
}
