/** Full-screen match end overlay — outcome headline, summary stats, new match. */

import { exitArenaPointerLock } from '../input/pointer-lock';

export type MatchResultOutcome = 'won' | 'lost';

export interface MatchResultSummary {
  readonly outcome: MatchResultOutcome;
  readonly playerKills: number;
  readonly playerDeaths: number;
  readonly playerKd: string;
  readonly ownTeamLabel: string;
  readonly ownTeamPoints: string;
  readonly ownTeamKills: number;
  readonly enemyTeamLabel: string;
  readonly enemyTeamPoints: string;
  readonly enemyTeamKills: number;
}

export interface MatchResultScreenMount {
  shell: HTMLElement;
}

function reloadToTitleScreen(): void {
  window.location.reload();
}

export class MatchResultScreen {
  readonly #overlay: HTMLDivElement;
  readonly #title: HTMLHeadingElement;
  readonly #playerKills: HTMLSpanElement;
  readonly #playerDeaths: HTMLSpanElement;
  readonly #playerKd: HTMLSpanElement;
  readonly #ownTeamLabel: HTMLSpanElement;
  readonly #ownTeamMetrics: HTMLSpanElement;
  readonly #enemyTeamLabel: HTMLSpanElement;
  readonly #enemyTeamMetrics: HTMLSpanElement;
  readonly #button: HTMLButtonElement;
  #visible = false;

  constructor(mount: MatchResultScreenMount) {
    const overlay = document.createElement('div');
    overlay.className = 'funnel-match-result-overlay';
    overlay.dataset.visible = 'false';
    overlay.innerHTML = `
      <div class="funnel-match-result-overlay__panel">
        <h2 class="funnel-match-result-overlay__title">YOUR TEAM WON</h2>
        <div class="funnel-match-result-overlay__stats" aria-label="Match summary">
          <div class="funnel-match-result-overlay__section">
            <p class="funnel-match-result-overlay__section-label">You</p>
            <div class="funnel-match-result-overlay__personal">
              <div class="funnel-match-result-overlay__metric">
                <span class="funnel-match-result-overlay__metric-value funnel-match-result-overlay__player-kills">0</span>
                <span class="funnel-match-result-overlay__metric-label">Kills</span>
              </div>
              <div class="funnel-match-result-overlay__metric">
                <span class="funnel-match-result-overlay__metric-value funnel-match-result-overlay__player-deaths">0</span>
                <span class="funnel-match-result-overlay__metric-label">Deaths</span>
              </div>
              <div class="funnel-match-result-overlay__metric">
                <span class="funnel-match-result-overlay__metric-value funnel-match-result-overlay__player-kd">—</span>
                <span class="funnel-match-result-overlay__metric-label">Ratio</span>
              </div>
            </div>
          </div>
          <div class="funnel-match-result-overlay__section">
            <p class="funnel-match-result-overlay__section-label">Teams</p>
            <div class="funnel-match-result-overlay__teams">
              <div class="funnel-match-result-overlay__team funnel-match-result-overlay__team--own">
                <span class="funnel-match-result-overlay__team-label funnel-match-result-overlay__own-label">Beta</span>
                <span class="funnel-match-result-overlay__team-metrics funnel-match-result-overlay__own-metrics">000 pts · 0 kills</span>
              </div>
              <div class="funnel-match-result-overlay__team funnel-match-result-overlay__team--enemy">
                <span class="funnel-match-result-overlay__team-label funnel-match-result-overlay__enemy-label">Alpha</span>
                <span class="funnel-match-result-overlay__team-metrics funnel-match-result-overlay__enemy-metrics">000 pts · 0 kills</span>
              </div>
            </div>
          </div>
        </div>
        <button type="button" class="funnel-btn funnel-btn--block funnel-match-result-overlay__action">New Match</button>
      </div>
    `;

    const title = overlay.querySelector<HTMLHeadingElement>('.funnel-match-result-overlay__title');
    const playerKills = overlay.querySelector<HTMLSpanElement>('.funnel-match-result-overlay__player-kills');
    const playerDeaths = overlay.querySelector<HTMLSpanElement>('.funnel-match-result-overlay__player-deaths');
    const playerKd = overlay.querySelector<HTMLSpanElement>('.funnel-match-result-overlay__player-kd');
    const ownTeamLabel = overlay.querySelector<HTMLSpanElement>('.funnel-match-result-overlay__own-label');
    const ownTeamMetrics = overlay.querySelector<HTMLSpanElement>('.funnel-match-result-overlay__own-metrics');
    const enemyTeamLabel = overlay.querySelector<HTMLSpanElement>('.funnel-match-result-overlay__enemy-label');
    const enemyTeamMetrics = overlay.querySelector<HTMLSpanElement>('.funnel-match-result-overlay__enemy-metrics');
    const button = overlay.querySelector<HTMLButtonElement>('.funnel-match-result-overlay__action');
    if (
      title === null ||
      playerKills === null ||
      playerDeaths === null ||
      playerKd === null ||
      ownTeamLabel === null ||
      ownTeamMetrics === null ||
      enemyTeamLabel === null ||
      enemyTeamMetrics === null ||
      button === null
    ) {
      throw new Error('FUNNEL match result overlay nodes were not created.');
    }

    this.#overlay = overlay;
    this.#title = title;
    this.#playerKills = playerKills;
    this.#playerDeaths = playerDeaths;
    this.#playerKd = playerKd;
    this.#ownTeamLabel = ownTeamLabel;
    this.#ownTeamMetrics = ownTeamMetrics;
    this.#enemyTeamLabel = enemyTeamLabel;
    this.#enemyTeamMetrics = enemyTeamMetrics;
    this.#button = button;
    mount.shell.append(overlay);
  }

  show(summary: MatchResultSummary): void {
    this.#visible = true;
    this.#overlay.dataset.visible = 'true';
    this.#overlay.dataset.outcome = summary.outcome;
    this.#title.textContent = summary.outcome === 'won' ? 'YOUR TEAM WON' : 'YOUR TEAM LOST';

    this.#playerKills.textContent = String(summary.playerKills);
    this.#playerDeaths.textContent = String(summary.playerDeaths);
    this.#playerKd.textContent = summary.playerKd;

    this.#ownTeamLabel.textContent = summary.ownTeamLabel;
    this.#ownTeamMetrics.textContent = `${summary.ownTeamPoints} pts · ${String(summary.ownTeamKills)} kills`;
    this.#enemyTeamLabel.textContent = summary.enemyTeamLabel;
    this.#enemyTeamMetrics.textContent = `${summary.enemyTeamPoints} pts · ${String(summary.enemyTeamKills)} kills`;

    exitArenaPointerLock();
    this.#button.focus({ preventScroll: true });
  }

  hide(): void {
    if (!this.#visible) {
      return;
    }

    this.#visible = false;
    this.#overlay.dataset.visible = 'false';
  }

  /** Waits for New Match (click or Enter) — full page reload. */
  waitForNewMatch(): Promise<never> {
    return new Promise(() => {
      const abort = new AbortController();
      const confirm = (): void => {
        abort.abort();
        reloadToTitleScreen();
      };

      this.#button.addEventListener('click', confirm, { once: true, signal: abort.signal });
      window.addEventListener(
        'keydown',
        (event) => {
          if (event.code !== 'Enter' && event.code !== 'NumpadEnter') {
            return;
          }
          if (event.repeat) {
            return;
          }

          event.preventDefault();
          confirm();
        },
        { capture: true, signal: abort.signal }
      );
    });
  }
}
