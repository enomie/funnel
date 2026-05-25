// Path: /Users/johann/MyBrew/funnel-real/src/ui/health-hud.ts

export interface HealthHudNodes {
  root: HTMLDivElement;
  shieldFill: HTMLDivElement;
  healthFill: HTMLDivElement;
}

export class HealthHud {
  readonly #root: HTMLDivElement;
  readonly #shieldFill: HTMLDivElement;
  readonly #healthFill: HTMLDivElement;
  #lastStateKey = '';

  constructor(nodes: HealthHudNodes) {
    this.#root = nodes.root;
    this.#shieldFill = nodes.shieldFill;
    this.#healthFill = nodes.healthFill;
  }

  update(
    health: number,
    maxHealth: number,
    shield: number,
    maxShield: number,
    isDead: boolean,
    isRegenerating: boolean
  ): void {
    const healthFraction = maxHealth > 0 ? Math.max(0, Math.min(1, health / maxHealth)) : 0;
    const shieldFraction = maxShield > 0 ? Math.max(0, Math.min(1, shield / maxShield)) : 0;
    const stateKey = [
      healthFraction.toFixed(3),
      shieldFraction.toFixed(3),
      isDead ? '1' : '0',
      isRegenerating ? '1' : '0'
    ].join('|');

    if (stateKey === this.#lastStateKey) {
      return;
    }

    this.#lastStateKey = stateKey;

    this.#healthFill.style.width = `${(healthFraction * 100).toFixed(1)}%`;
    this.#shieldFill.style.width = `${(shieldFraction * 100).toFixed(1)}%`;

    this.#root.dataset.dead = isDead ? 'true' : 'false';
    this.#root.dataset.low = !isDead && healthFraction <= 0.35 ? 'true' : 'false';
    this.#root.dataset.regen = !isDead && isRegenerating ? 'true' : 'false';
  }
}
