import { DAMAGE_HIT_FLASH_MS } from '../combat/damage-feedback';
import { deriveTeamHex } from '../combat/team-color-derive';

const REF_DAMAGE = 84;

export class DamageVignetteHud {
  readonly #root: HTMLDivElement;
  #timeout: ReturnType<typeof setTimeout> | null = null;

  constructor(root: HTMLDivElement) {
    this.#root = root;
    const hex = deriveTeamHex('enemy', 'base');
    const r = (hex >> 16) & 255;
    const g = (hex >> 8) & 255;
    const b = hex & 255;
    root.style.setProperty('--funnel-enemy-rgb', `${r.toString()}, ${g.toString()}, ${b.toString()}`);
  }

  /** Team-red browser-edge flash when the local player takes damage. */
  flash(amount: number): void {
    const intensity = Math.min(1, 0.42 + amount / REF_DAMAGE * 0.5);
    this.#root.style.setProperty('--damage-intensity', intensity.toFixed(3));
    this.#root.dataset.active = 'true';

    if (this.#timeout !== null) {
      clearTimeout(this.#timeout);
    }

    this.#timeout = setTimeout(() => {
      delete this.#root.dataset.active;
      this.#timeout = null;
    }, DAMAGE_HIT_FLASH_MS);
  }
}
