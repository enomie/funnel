// Path: /Users/johann/MyBrew/funnel-real/src/bots/bot-respawn.ts

import { effectiveRespawnElapsedMs, type ActorDeathSnapshot } from '../player/actor-death';
import { PLAYER_AUTO_RESPAWN_MS } from '../player/player-auto-respawn';

export const BOT_RESPAWN_DELAY_S = 5;

export const BOT_RESPAWN_DELAY_MS = PLAYER_AUTO_RESPAWN_MS;

export const BOT_RESPAWN_STAGGER_WINDOW_S = 2.5;

export function botRespawnDueElapsedMs(phaseSlot: number, phaseSlotCount: number): number {
  const slots = Math.max(1, phaseSlotCount);
  const slot = ((phaseSlot % slots) + slots) % slots;
  const staggerMs = (slot / slots) * BOT_RESPAWN_STAGGER_WINDOW_S * 1000;
  return BOT_RESPAWN_DELAY_MS + staggerMs;
}

export function botAutoRespawnDue(
  nowMs: number,
  snapshot: ActorDeathSnapshot,
  phaseSlot: number,
  phaseSlotCount: number
): boolean {
  if (!snapshot.applied || snapshot.diedAtMs <= 0) {
    return false;
  }

  return effectiveRespawnElapsedMs(nowMs, snapshot) >= botRespawnDueElapsedMs(phaseSlot, phaseSlotCount);
}

/** @deprecated Use botAutoRespawnDue with death snapshot pause fields. */
export function botRespawnDueAtMs(
  deathTimeMs: number,
  phaseSlot: number,
  phaseSlotCount: number
): number {
  if (deathTimeMs <= 0) {
    return Infinity;
  }

  return deathTimeMs + botRespawnDueElapsedMs(phaseSlot, phaseSlotCount);
}
