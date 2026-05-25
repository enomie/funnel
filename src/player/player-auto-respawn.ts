// Path: /Users/johann/MyBrew/funnel-real/src/player/player-auto-respawn.ts

import {
  effectiveRespawnElapsedMs,
  type ActorDeathSnapshot
} from './actor-death';

export const PLAYER_AUTO_RESPAWN_SECONDS = 5;

export const PLAYER_AUTO_RESPAWN_MS = PLAYER_AUTO_RESPAWN_SECONDS * 1000;

export function playerAutoRespawnDueAtMs(diedAtMs: number): number {
  return diedAtMs + PLAYER_AUTO_RESPAWN_MS;
}

export function playerAutoRespawnCountdownSeconds(
  nowMs: number,
  snapshot: ActorDeathSnapshot
): number {
  if (snapshot.diedAtMs <= 0 && !snapshot.applied) {
    return 0;
  }

  const remainingMs = PLAYER_AUTO_RESPAWN_MS - effectiveRespawnElapsedMs(nowMs, snapshot);
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

export function playerAutoRespawnDue(nowMs: number, snapshot: ActorDeathSnapshot): boolean {
  if (snapshot.diedAtMs <= 0 && !snapshot.applied) {
    return false;
  }

  return effectiveRespawnElapsedMs(nowMs, snapshot) >= PLAYER_AUTO_RESPAWN_MS;
}
