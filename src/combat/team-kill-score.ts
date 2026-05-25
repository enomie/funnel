// Path: /Users/johann/MyBrew/funnel-real/src/combat/team-kill-score.ts

import { areSameFaction, type FactionTeam } from './teams';


export class TeamKillScore {
  readonly #kills: Record<FactionTeam, number> = { alpha: 0, beta: 0 };

  recordKill(killerFaction: FactionTeam, victimFaction: FactionTeam): void {
    if (areSameFaction(killerFaction, victimFaction)) {
      return;
    }

    this.#kills[killerFaction] += 1;
  }

  killsBy(faction: FactionTeam): number {
    return this.#kills[faction];
  }

  reset(): void {
    this.#kills.alpha = 0;
    this.#kills.beta = 0;
  }
}
