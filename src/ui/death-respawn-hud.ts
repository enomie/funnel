/** Full-screen death overlay: WASTED + respawn countdown. */

export interface DeathRespawnHudMount {
  shell: HTMLElement;
}

export class DeathRespawnHud {
  readonly #overlay: HTMLDivElement;
  readonly #value: HTMLDivElement;
  #visible = false;
  #lastSeconds = -1;

  constructor(mount: DeathRespawnHudMount) {
    const overlay = document.createElement('div');
    overlay.className = 'funnel-death-overlay';
    overlay.dataset.visible = 'false';
    overlay.innerHTML = `
      <div class="funnel-death-overlay__panel">
        <h2 class="funnel-death-overlay__title">WASTED</h2>
        <p class="funnel-death-overlay__kicker">Respawn in</p>
        <div class="funnel-death-overlay__value" aria-live="polite">5</div>
      </div>
    `;

    const value = overlay.querySelector<HTMLDivElement>('.funnel-death-overlay__value');
    if (value === null) {
      throw new Error('FUNNEL death overlay countdown node was not created.');
    }

    this.#overlay = overlay;
    this.#value = value;
    mount.shell.append(overlay);
  }

  /** `secondsLeft` — whole seconds until respawn; `0` hides overlay (alive or respawning). */
  update(isDead: boolean, secondsLeft: number): void {
    if (!isDead || secondsLeft <= 0) {
      if (this.#visible) {
        this.#visible = false;
        this.#lastSeconds = -1;
        this.#overlay.dataset.visible = 'false';
      }
      return;
    }

    if (!this.#visible) {
      this.#visible = true;
      this.#overlay.dataset.visible = 'true';
    }

    if (secondsLeft !== this.#lastSeconds) {
      this.#lastSeconds = secondsLeft;
      this.#value.textContent = String(secondsLeft);
    }
  }
}
