/** Max bot respawns per render frame — caps physics/weapon/visual spikes after mass kills. */
export const BOT_RESPAWN_BUDGET_PER_FRAME = 2;

let respawnsThisFrame = 0;

export function beginBotRespawnBudgetFrame(): void {
  respawnsThisFrame = 0;
}

/** Returns false when the per-frame respawn budget is exhausted — bot retries next frame. */
export function tryAcquireBotRespawn(): boolean {
  if (respawnsThisFrame >= BOT_RESPAWN_BUDGET_PER_FRAME) {
    return false;
  }

  respawnsThisFrame += 1;
  return true;
}
