import { PLAYER_CONFIG } from '../config/game-config';

export class PlayerHealth {
  readonly #maxHealth: number;
  #health: number;
  #dead = false;

  constructor(maxHealth = PLAYER_CONFIG.maxHealth) {
    this.#maxHealth = maxHealth;
    this.#health = maxHealth;
  }

  get health(): number {
    return this.#health;
  }

  get maxHealth(): number {
    return this.#maxHealth;
  }

  get isDead(): boolean {
    return this.#dead;
  }

  damage(amount: number): void {
    if (this.#dead || amount <= 0) {
      return;
    }

    this.#health = Math.max(0, this.#health - amount);
    if (this.#health <= 0) {
      this.kill();
    }
  }

  kill(): void {
    this.#dead = true;
    this.#health = 0;
  }

  respawn(): void {
    this.#dead = false;
    this.#health = this.#maxHealth;
  }
}
