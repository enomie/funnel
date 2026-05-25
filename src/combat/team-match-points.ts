// Path: /Users/johann/MyBrew/funnel-real/src/combat/team-match-points.ts

import { MATCH_CONFIG } from '../config/game-config';
import { areSameFaction, type FactionTeam } from './teams';

export class TeamMatchPoints {
  readonly #points: Record<FactionTeam, number> = { alpha: 0, beta: 0 };
  #winner: FactionTeam | null = null;

  recordCrossFactionKill(killerFaction: FactionTeam, victimFaction: FactionTeam): void {
    if (areSameFaction(killerFaction, victimFaction)) {
      return;
    }

    this.#addPoints(killerFaction, MATCH_CONFIG.pointsPerCrossFactionKill);
  }

  recordPresenceSecond(faction: FactionTeam): void {
    this.#addPoints(faction, MATCH_CONFIG.pointsPerPresenceSecond);
  }

  #addPoints(faction: FactionTeam, amount: number): void {
    if (this.#winner !== null || amount <= 0) {
      return;
    }

    this.#points[faction] += amount;

    if (this.#points[faction] >= MATCH_CONFIG.pointsToWin) {
      this.#winner = faction;
    }
  }

  get winner(): FactionTeam | null {
    return this.#winner;
  }

  get isMatchOver(): boolean {
    return this.#winner !== null;
  }

  reset(): void {
    this.#points.alpha = 0;
    this.#points.beta = 0;
    this.#winner = null;
  }

  pointsBy(faction: FactionTeam): number {
    return this.#points[faction];
  }

  
  formatDisplayPoints(faction: FactionTeam): string {
    const clamped = Math.min(MATCH_CONFIG.pointsDisplayMax, Math.max(0, this.#points[faction]));
    return String(clamped).padStart(3, '0');
  }
}
