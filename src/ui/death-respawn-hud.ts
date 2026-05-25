// Path: /Users/johann/MyBrew/funnel-real/src/ui/death-respawn-hud.ts

export interface DeathKillerDisplay {
  weaponName: string;
  weaponColorCss: string;
}

export interface DeathRespawnHudMount {
  shell: HTMLElement;
}

export class DeathRespawnHud {
  readonly #overlay: HTMLDivElement;
  readonly #value: HTMLDivElement;
  readonly #killerLine: HTMLParagraphElement;
  readonly #killerWeapon: HTMLSpanElement;
  #visible = false;
  #lastSeconds = -1;
  #lastKillerKey = '';

  constructor(mount: DeathRespawnHudMount) {
    const overlay = document.createElement('div');
    overlay.className = 'funnel-death-overlay';
    overlay.dataset.visible = 'false';
    overlay.innerHTML = `
      <div class="funnel-death-overlay__panel">
        <h2 class="funnel-death-overlay__title">WASTED</h2>
        <p class="funnel-death-overlay__kicker">Respawn in</p>
        <div class="funnel-death-overlay__value" aria-live="polite">5</div>
        <p class="funnel-death-overlay__killer" hidden>
          Killed by <span class="funnel-death-overlay__weapon"></span>
        </p>
      </div>
    `;

    const value = overlay.querySelector<HTMLDivElement>('.funnel-death-overlay__value');
    const killerLine = overlay.querySelector<HTMLParagraphElement>('.funnel-death-overlay__killer');
    const killerWeapon = overlay.querySelector<HTMLSpanElement>('.funnel-death-overlay__weapon');
    if (value === null || killerLine === null || killerWeapon === null) {
      throw new Error('FUNNEL death overlay nodes were not created.');
    }

    this.#overlay = overlay;
    this.#value = value;
    this.#killerLine = killerLine;
    this.#killerWeapon = killerWeapon;
    mount.shell.append(overlay);
  }

  update(isDead: boolean, secondsLeft: number, killedBy: DeathKillerDisplay | null = null): void {
    if (!isDead || secondsLeft <= 0) {
      if (this.#visible) {
        this.#visible = false;
        this.#lastSeconds = -1;
        this.#lastKillerKey = '';
        this.#overlay.dataset.visible = 'false';
        this.#killerLine.hidden = true;
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

    const killerKey = killedBy === null ? '' : `${killedBy.weaponName}|${killedBy.weaponColorCss}`;
    if (killerKey === this.#lastKillerKey) {
      return;
    }

    this.#lastKillerKey = killerKey;
    if (killedBy === null) {
      this.#killerLine.hidden = true;
      return;
    }

    this.#killerLine.hidden = false;
    this.#killerWeapon.textContent = killedBy.weaponName;
    this.#killerWeapon.style.color = killedBy.weaponColorCss;
  }
}
