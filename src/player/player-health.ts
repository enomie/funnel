import { PLAYER_CONFIG } from '../config/game-config';

export interface DamageResult {
  readonly healthDamage: number;
  readonly shieldDamage: number;
  readonly remainingHealth: number;
  readonly remainingShield: number;
}

export class PlayerHealth {
  readonly #maxHealth: number;
  readonly #maxShield: number;
  readonly #regenDelayMs: number;
  readonly #regenPerSecond: number;
  #health: number;
  #shield: number;
  #dead = false;
  #lastDamageAtMs = -Infinity;

  constructor(
    maxHealth = PLAYER_CONFIG.maxHealth,
    maxShield = PLAYER_CONFIG.maxShield
  ) {
    this.#maxHealth = maxHealth;
    this.#maxShield = maxShield;
    this.#regenDelayMs = PLAYER_CONFIG.healthRegenDelayMs;
    this.#regenPerSecond = PLAYER_CONFIG.healthRegenPerSecond;
    this.#health = maxHealth;
    this.#shield = maxShield;
  }

  get health(): number {
    return this.#health;
  }

  get shield(): number {
    return this.#shield;
  }

  get maxHealth(): number {
    return this.#maxHealth;
  }

  get maxShield(): number {
    return this.#maxShield;
  }

  get isDead(): boolean {
    return this.#dead;
  }

  get isRegenerating(): boolean {
    if (this.#dead || this.#health >= this.#maxHealth) {
      return false;
    }

    return performance.now() - this.#lastDamageAtMs >= this.#regenDelayMs;
  }

  /** Shield absorbs damage first; overflow hits health. Shield never regens on its own. */
  damage(amount: number): DamageResult {
    if (this.#dead || amount <= 0) {
      return {
        healthDamage: 0,
        shieldDamage: 0,
        remainingHealth: this.#health,
        remainingShield: this.#shield
      };
    }

    this.#lastDamageAtMs = performance.now();

    const shieldDamage = Math.min(this.#shield, amount);
    this.#shield -= shieldDamage;
    const healthDamage = Math.min(this.#health, amount - shieldDamage);
    this.#health -= healthDamage;

    if (this.#health <= 0) {
      this.kill();
    }

    return {
      healthDamage,
      shieldDamage,
      remainingHealth: this.#health,
      remainingShield: this.#shield
    };
  }

  /** Passive health refill — call once per frame from the game loop. */
  tickRegen(nowMs: number, deltaSeconds: number): void {
    if (this.#dead || this.#health >= this.#maxHealth || deltaSeconds <= 0) {
      return;
    }

    if (nowMs - this.#lastDamageAtMs < this.#regenDelayMs) {
      return;
    }

    this.#health = Math.min(
      this.#maxHealth,
      this.#health + this.#regenPerSecond * deltaSeconds
    );
  }

  /** Shield belt pickup — does not reset the health regen delay. */
  addShield(amount: number): number {
    if (this.#dead || amount <= 0) {
      return 0;
    }

    const before = this.#shield;
    this.#shield = Math.min(this.#maxShield, this.#shield + amount);
    return this.#shield - before;
  }

  /** Health pack pickup — does not reset the health regen delay. */
  addHealth(amount: number): number {
    if (this.#dead || amount <= 0) {
      return 0;
    }

    const before = this.#health;
    this.#health = Math.min(this.#maxHealth, this.#health + amount);
    return this.#health - before;
  }

  kill(): void {
    this.#dead = true;
    this.#health = 0;
    this.#shield = 0;
  }

  respawn(): void {
    this.#dead = false;
    this.#health = this.#maxHealth;
    this.#shield = this.#maxShield;
    this.#lastDamageAtMs = -Infinity;
  }
}
