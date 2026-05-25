// Path: /Users/johann/MyBrew/funnel-real/src/ui/damage-vignette-hud.ts

import { DAMAGE_HIT_FLASH_MS } from '../combat/damage-feedback';

const REF_DAMAGE = 84;

export class DamageVignetteHud {
  readonly #root: HTMLDivElement;
  #timeout: ReturnType<typeof setTimeout> | null = null;

  constructor(root: HTMLDivElement) {
    this.#root = root;
  }

  
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
