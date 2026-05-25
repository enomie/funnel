import type { PersonalMatchStats } from '../combat/personal-match-stats';

export interface PersonalStatsHudNodes {
  root: HTMLDivElement;
  kills: HTMLSpanElement;
  deaths: HTMLSpanElement;
  kdRatio: HTMLSpanElement;
}

function formatKdValue(stats: PersonalMatchStats): string {
  if (stats.kills() === 0 && stats.deaths() === 0) {
    return '-';
  }

  return stats.formatKdRatio();
}

export class PersonalStatsHud {
  readonly #kills: HTMLSpanElement;
  readonly #deaths: HTMLSpanElement;
  readonly #kdRatio: HTMLSpanElement;
  #lastStateKey = '';

  constructor(nodes: PersonalStatsHudNodes) {
    this.#kills = nodes.kills;
    this.#deaths = nodes.deaths;
    this.#kdRatio = nodes.kdRatio;
  }

  update(stats: PersonalMatchStats): void {
    const kdValue = formatKdValue(stats);
    const stateKey = `${String(stats.kills())}|${String(stats.deaths())}|${kdValue}`;
    if (stateKey === this.#lastStateKey) {
      return;
    }

    this.#lastStateKey = stateKey;
    this.#kills.textContent = String(stats.kills());
    this.#deaths.textContent = String(stats.deaths());
    this.#kdRatio.textContent = kdValue;
  }
}
