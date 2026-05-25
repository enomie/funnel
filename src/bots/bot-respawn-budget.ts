// Path: /Users/johann/MyBrew/funnel-real/src/bots/bot-respawn-budget.ts


export const BOT_RESPAWN_BUDGET_PER_FRAME = 2;

let respawnsThisFrame = 0;

export function beginBotRespawnBudgetFrame(): void {
  respawnsThisFrame = 0;
}


export function tryAcquireBotRespawn(): boolean {
  if (respawnsThisFrame >= BOT_RESPAWN_BUDGET_PER_FRAME) {
    return false;
  }

  respawnsThisFrame += 1;
  return true;
}
