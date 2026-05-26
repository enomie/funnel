// Path: /Users/johann/MyBrew/funnel-real/src/ui/match-flow-screen.ts



import type { HumanoidRigId } from '../player/humanoid-rig';
import { createFunnelGameBrandElement } from './funnel-game-brand';

export const MATCH_COUNTDOWN_SECONDS = 10;

export type MatchFlowPhase = 'character-select' | 'countdown' | 'playing' | 'ended';

export type PreMatchPhase = 'boot-loading' | 'character-select' | 'game-loading';

export interface MatchFlowScreenMount {
  preMatchHost: HTMLElement;
  shell: HTMLElement;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export class MatchFlowScreen {
  readonly #preMatchHost: HTMLElement;
  readonly #shell: HTMLElement;
  readonly #preMatchScreen: HTMLDivElement;
  #loadingPanel: HTMLDivElement | null = null;
  #progressBar: HTMLDivElement | null = null;
  #progressLabel: HTMLParagraphElement | null = null;
  #characterSelectOverlay: HTMLDivElement | null = null;
  #countdownOverlay: HTMLDivElement | null = null;
  #countdownValue: HTMLDivElement | null = null;

  constructor(mount: MatchFlowScreenMount) {
    this.#preMatchHost = mount.preMatchHost;
    this.#shell = mount.shell;

    this.#preMatchScreen = document.createElement('div');
    this.#preMatchScreen.className = 'funnel-prematch-screen';
    this.#preMatchHost.append(this.#preMatchScreen);

    this.#countdownOverlay = this.#createCountdownOverlay();
    this.#preMatchHost.hidden = true;
  }

  #createCountdownOverlay(): HTMLDivElement {
    const countdownOverlay = document.createElement('div');
    countdownOverlay.className = 'funnel-countdown-overlay';
    countdownOverlay.hidden = true;
    countdownOverlay.innerHTML = `
      <div class="funnel-countdown-overlay__panel">
        <p class="funnel-countdown-overlay__kicker">Match start</p>
        <div class="funnel-countdown-overlay__value" aria-live="polite">10</div>
        <p class="funnel-countdown-overlay__tagline">Get ready</p>
      </div>
    `;
    const countdownValue = countdownOverlay.querySelector<HTMLDivElement>('.funnel-countdown-overlay__value');
    if (countdownValue === null) {
      throw new Error('FUNNEL countdown overlay node was not created.');
    }
    this.#countdownValue = countdownValue;
    return countdownOverlay;
  }

  setMatchPhase(phase: MatchFlowPhase): void {
    this.#shell.dataset.matchPhase = phase;
  }

  setPreMatchPhase(phase: PreMatchPhase): void {
    this.#preMatchHost.dataset.matchPhase = phase;
    if (this.#loadingPanel !== null) {
      this.#loadingPanel.hidden = phase !== 'boot-loading' && phase !== 'game-loading';
    }
  }

  #ensureLoadingPanel(): void {
    if (this.#loadingPanel !== null) {
      return;
    }

    const loadingPanel = document.createElement('div');
    loadingPanel.className = 'funnel-prematch-screen__panel funnel-prematch-screen__panel--loader';
    loadingPanel.dataset.panel = 'loading';
    loadingPanel.innerHTML = `
      <div class="funnel-prematch-screen__loader-brand">
        <p class="funnel-prematch-screen__welcome">Welcome to the</p>
        <h1 class="funnel-prematch-screen__brand funnel-prematch-screen__brand--loader">
          <img
            class="funnel-prematch-screen__logo"
            src="/icons/logo-standalone.svg"
            alt="FUNNEL"
            decoding="async"
          />
        </h1>
      </div>
      <div class="funnel-prematch-screen__loader-progress">
        <p class="funnel-prematch-screen__progress-label">Preparing…</p>
        <div class="funnel-prematch-screen__progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100">
          <div class="funnel-prematch-screen__progress-fill"></div>
        </div>
      </div>
    `;

    const progressLabel = loadingPanel.querySelector<HTMLParagraphElement>(
      '.funnel-prematch-screen__progress-label'
    );
    const progressBar = loadingPanel.querySelector<HTMLDivElement>('.funnel-prematch-screen__progress-fill');
    if (progressLabel === null || progressBar === null) {
      throw new Error('FUNNEL game loader nodes were not created.');
    }

    this.#loadingPanel = loadingPanel;
    this.#progressLabel = progressLabel;
    this.#progressBar = progressBar;
    this.#preMatchScreen.append(loadingPanel);
  }

  
  beginFromHomeNavigation(): void {
    this.#shell.hidden = true;
  }

  beginBootLoading(): void {
    this.#ensureLoadingPanel();
    this.#shell.hidden = true;
    this.#preMatchHost.hidden = false;
    this.setPreMatchPhase('boot-loading');
    this.setLoadingProgress(0, 'Preparing…');
  }

  showCharacterSelectOverlay(): void {
    this.setPreMatchPhase('character-select');
    this.#preMatchHost.hidden = true;
    this.#shell.hidden = false;
    this.setMatchPhase('character-select');
    this.#ensureCharacterSelectOverlay();
    if (this.#characterSelectOverlay !== null) {
      this.#characterSelectOverlay.hidden = false;
    }
    this.setCharacterSelectHoverLabel(null);
  }

  setCharacterSelectHoverLabel(rigId: HumanoidRigId | null): void {
    if (this.#characterSelectOverlay === null) {
      return;
    }

    const names = this.#characterSelectOverlay.querySelectorAll<HTMLSpanElement>(
      '.funnel-character-select-overlay__name'
    );
    for (const name of names) {
      if (rigId !== null && name.dataset.rig === rigId) {
        name.dataset.hovered = 'true';
      } else {
        delete name.dataset.hovered;
      }
    }
  }

  hideCharacterSelectOverlay(): void {
    this.#removeCharacterSelectOverlay();
  }

  #ensureCharacterSelectOverlay(): void {
    if (this.#characterSelectOverlay !== null) {
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'funnel-character-select-overlay';

    const head = document.createElement('div');
    head.className = 'funnel-character-select-overlay__head';
    head.append(createFunnelGameBrandElement());

    const title = document.createElement('p');
    title.className = 'funnel-character-select-overlay__title';
    title.textContent = 'Select your fighter';
    head.append(title);

    const roster = document.createElement('div');
    roster.className = 'funnel-character-select-overlay__roster';
    roster.setAttribute('aria-label', 'Fighters');
    roster.innerHTML = `
        <span class="funnel-character-select-overlay__name" data-rig="y-bot">Y-Bot</span>
        <span class="funnel-character-select-overlay__name" data-rig="x-bot">X-Bot</span>
    `;

    overlay.append(head, roster);

    this.#characterSelectOverlay = overlay;
    this.#shell.append(overlay);
  }

  beginGameLoading(): void {
    this.hideCharacterSelectOverlay();
    this.#ensureLoadingPanel();
    this.#shell.hidden = true;
    this.#preMatchHost.hidden = false;
    this.setPreMatchPhase('game-loading');
    this.setLoadingProgress(0, 'Preparing…');
  }

  setLoadingProgress(percent: number, label: string): void {
    if (this.#progressBar === null || this.#progressLabel === null) {
      return;
    }

    const clamped = Math.max(0, Math.min(100, percent));
    this.#progressBar.style.width = `${String(clamped)}%`;
    this.#progressLabel.textContent = label;
    const track = this.#progressBar.parentElement;
    if (track !== null) {
      track.setAttribute('aria-valuenow', String(Math.round(clamped)));
    }
  }

  
  revealMap(): void {
    this.#preMatchHost.hidden = true;
    this.#shell.hidden = false;
    this.#removeCharacterSelectOverlay();
    this.#ensureCountdownOverlay();
    if (this.#countdownOverlay !== null) {
      this.#countdownOverlay.hidden = true;
    }
    this.setMatchPhase('countdown');
  }

  #removeCharacterSelectOverlay(): void {
    if (this.#characterSelectOverlay !== null) {
      this.#characterSelectOverlay.remove();
      this.#characterSelectOverlay = null;
    }
  }

  #ensureCountdownOverlay(): void {
    if (this.#countdownOverlay === null) {
      this.#countdownOverlay = this.#createCountdownOverlay();
    }
    if (this.#countdownOverlay.parentElement === null) {
      this.#shell.append(this.#countdownOverlay);
    }
  }

  async runCountdown(
    fromSeconds = MATCH_COUNTDOWN_SECONDS,
    onTick?: (remaining: number) => void
  ): Promise<void> {
    if (this.#countdownOverlay === null || this.#countdownValue === null) {
      throw new Error('FUNNEL countdown overlay was not initialized.');
    }
    this.#countdownOverlay.hidden = false;

    for (let remaining = fromSeconds; remaining >= 0; remaining -= 1) {
      this.#countdownValue.textContent = String(remaining);
      onTick?.(remaining);
      if (remaining === 0) {
        break;
      }
      await sleep(1000);
    }
  }

  dismissCountdown(): void {
    if (this.#countdownOverlay !== null) {
      this.#countdownOverlay.remove();
      this.#countdownOverlay = null;
      this.#countdownValue = null;
    }
    this.#preMatchHost.remove();
    this.setMatchPhase('playing');
  }
}
