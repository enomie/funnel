import {
  BIO_LOBBER_KILL_RADIUS_MIN_M,
  type FireProfile,
  type ImpactProfile
} from './weapon-definitions';

const DEFAULT_CHARGE_MIN_MS = 160;
const DEFAULT_CHARGE_MAX_MS = 1200;
const DEFAULT_CHARGE_MIN_SCALE = 0.52;
const DEFAULT_CHARGE_MIN_DAMAGE = 0.48;
const DEFAULT_CHARGE_MIN_STICK_MS = 0.72;
const DEFAULT_CHARGE_MIN_IMPACT_EXPAND_MS = 320;

export interface BioChargeSnapshot {
  fraction: number;
  projectileScale: number;
  damage: number;
  impactRadius: number;
  impactExpandMs: number;
  stickDelayMs: number;
}

export class BioChargeState {
  #holding = false;
  #holdStartedAtMs = 0;

  get isHolding(): boolean {
    return this.#holding;
  }

  beginHold(nowMs: number): void {
    this.#holding = true;
    this.#holdStartedAtMs = nowMs;
  }

  cancelHold(): void {
    this.#holding = false;
    this.#holdStartedAtMs = 0;
  }

  snapshot(nowMs: number, fire: FireProfile, impact: ImpactProfile): BioChargeSnapshot {
    const chargeMinMs = fire.chargeMinMs ?? DEFAULT_CHARGE_MIN_MS;
    const chargeMaxMs = fire.chargeMaxMs ?? DEFAULT_CHARGE_MAX_MS;
    const minScale = fire.chargeMinScale ?? DEFAULT_CHARGE_MIN_SCALE;
    const elapsed = this.#holding ? nowMs - this.#holdStartedAtMs : 0;
    const fraction =
      elapsed <= chargeMinMs
        ? 0
        : Math.min(1, (elapsed - chargeMinMs) / Math.max(1, chargeMaxMs - chargeMinMs));

    const maxScale = fire.projectileScale ?? 1;
    const maxDamage = fire.damage;
    const maxImpactRadius = impact.impactRadius;
    const maxImpactExpandMs = impact.impactExpandMs;
    const maxStickMs = impact.stickDelayMs ?? 0;

    return {
      fraction,
      projectileScale: lerp(maxScale * minScale, maxScale, fraction),
      damage: Math.round(lerp(maxDamage * DEFAULT_CHARGE_MIN_DAMAGE, maxDamage, fraction)),
      impactRadius: lerp(BIO_LOBBER_KILL_RADIUS_MIN_M, maxImpactRadius, fraction),
      impactExpandMs: Math.round(
        lerp(DEFAULT_CHARGE_MIN_IMPACT_EXPAND_MS, maxImpactExpandMs, fraction)
      ),
      stickDelayMs: Math.round(lerp(maxStickMs * DEFAULT_CHARGE_MIN_STICK_MS, maxStickMs, fraction))
    };
  }
}

function lerp(min: number, max: number, t: number): number {
  return min + (max - min) * t;
}
