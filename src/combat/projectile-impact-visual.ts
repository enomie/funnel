// Path: /Users/johann/MyBrew/funnel-real/src/combat/projectile-impact-visual.ts

import type { ImpactProfile, WeaponDefinition } from './weapon-definitions';
import type { InstancedImpactBurst, SphereInstancingService } from '../render/sphere-instancing';
import {
  IMPACT_BURST_DURATION_MS,
  IMPACT_BURST_START_SCALE,
  ROCKET_IMPACT_BURST_DURATION_MS
} from '../render/sphere-vfx-tuning';

export { brightenImpactColor } from '../render/sphere-vfx-tuning';

const RICOCHET_VFX_RADIUS_SCALE = 0.52;
const SMALL_ARMS_VFX_RADIUS_FLOOR: Partial<Record<WeaponDefinition['visualKind'], number>> = {
  pistol: 0.44,
  gatling: 0.36,
  pulse: 0.48
};
const SMALL_ARMS_VFX_START_SCALE_FRACTION = 0.28;
const SMALL_ARMS_IMPACT_EXPAND_PEAK_FRACTION = 0.48;
const SMALL_ARMS_IMPACT_OPACITY_FADE = 0.72;
const SMALL_ARMS_IMPACT_OPACITY_FADE_POWER = 2.1;
const SMALL_ARMS_IMPACT_START_SCALE_MIN = 0.05;

function isSmallArmsVisualKind(kind: WeaponDefinition['visualKind']): boolean {
  return SMALL_ARMS_VFX_RADIUS_FLOOR[kind] !== undefined;
}
const FLAK_IMPACT_START_SCALE_FRACTION = 0.22;
const FLAK_IMPACT_EXPAND_PEAK_FRACTION = 0.32;
const FLAK_IMPACT_OPACITY_FADE = 2.6;

const ROCKET_IMPACT_START_SCALE = 0.06;
const ROCKET_IMPACT_EXPAND_PEAK_FRACTION = 0.16;
const ROCKET_IMPACT_OPACITY_FADE = 0.58;
const ROCKET_IMPACT_OPACITY_FADE_POWER = 2.4;

const REDEEMER_IMPACT_EXPAND_PEAK_FRACTION = 0.78;
const REDEEMER_IMPACT_CONTRACT_END_FRACTION = 0.08;
const REDEEMER_IMPACT_OPACITY_PEAK = 0.9;
const REDEEMER_IMPACT_OPACITY_FADE = 0.22;
const REDEEMER_IMPACT_OPACITY_FADE_POWER = 3.1;

const LETHAL_KILL_EXPAND_PEAK_FRACTION = 0.4;
const LETHAL_KILL_CONTRACT_END_FRACTION = 0.14;
const LETHAL_KILL_OPACITY_FADE = 1.35;
const LETHAL_KILL_OPACITY_FADE_POWER = 1.8;

export type ImpactBurstKind = 'hit' | 'ricochet';

export type ImpactBurst = InstancedImpactBurst;


export function resolveImpactVfxRadius(
  weapon: WeaponDefinition,
  impact: ImpactProfile,
  kind: ImpactBurstKind,
  radiusOverride?: number
): number {
  const base = radiusOverride ?? impact.impactRadius;
  if (base <= 0) {
    return 0;
  }

  const scaled = kind === 'ricochet' ? base * RICOCHET_VFX_RADIUS_SCALE : base;
  const floor = SMALL_ARMS_VFX_RADIUS_FLOOR[weapon.visualKind];
  if (floor === undefined) {
    return scaled;
  }

  return Math.max(scaled, floor);
}

function resolveImpactBurstDuration(weapon: WeaponDefinition, impact: ImpactProfile): number {
  if (weapon.visualKind === 'redeemer' || impact.expandingLethal === true) {
    return impact.impactExpandMs;
  }
  if (weapon.visualKind === 'rocket') {
    return ROCKET_IMPACT_BURST_DURATION_MS;
  }
  if (isSmallArmsVisualKind(weapon.visualKind) && impact.impactExpandMs > 0) {
    return impact.impactExpandMs;
  }
  return IMPACT_BURST_DURATION_MS;
}

function resolveImpactBurstProfile(
  weapon: WeaponDefinition,
  impact: ImpactProfile
): {
  expandPeakFraction?: number;
  expandEase?: 'quad' | 'cubic';
  contractEndScaleFraction?: number;
  opacityPeak?: number;
  opacityFade?: number;
  opacityFadePower?: number;
  hotBurst?: boolean;
} {
  if (weapon.visualKind === 'redeemer' || impact.expandingLethal === true) {
    if (weapon.visualKind === 'shock') {
      return {
        expandPeakFraction: LETHAL_KILL_EXPAND_PEAK_FRACTION,
        expandEase: 'cubic',
        contractEndScaleFraction: LETHAL_KILL_CONTRACT_END_FRACTION,
        opacityFade: LETHAL_KILL_OPACITY_FADE,
        opacityFadePower: LETHAL_KILL_OPACITY_FADE_POWER,
        hotBurst: true
      };
    }

    return {
      expandPeakFraction: REDEEMER_IMPACT_EXPAND_PEAK_FRACTION,
      expandEase: 'cubic',
      contractEndScaleFraction: REDEEMER_IMPACT_CONTRACT_END_FRACTION,
      opacityPeak: REDEEMER_IMPACT_OPACITY_PEAK,
      opacityFade: REDEEMER_IMPACT_OPACITY_FADE,
      opacityFadePower: REDEEMER_IMPACT_OPACITY_FADE_POWER,
      hotBurst: true
    };
  }

  if (impact.lethalSplash === true) {
    return {
      expandPeakFraction:
        weapon.visualKind === 'flak' ? FLAK_IMPACT_EXPAND_PEAK_FRACTION : LETHAL_KILL_EXPAND_PEAK_FRACTION,
      expandEase: 'cubic',
      contractEndScaleFraction: LETHAL_KILL_CONTRACT_END_FRACTION,
      opacityFade: weapon.visualKind === 'flak' ? FLAK_IMPACT_OPACITY_FADE : LETHAL_KILL_OPACITY_FADE,
      opacityFadePower: LETHAL_KILL_OPACITY_FADE_POWER,
      hotBurst: true
    };
  }

  if (weapon.visualKind === 'rocket') {
    return {
      expandPeakFraction: ROCKET_IMPACT_EXPAND_PEAK_FRACTION,
      expandEase: 'cubic',
      opacityFade: ROCKET_IMPACT_OPACITY_FADE,
      opacityFadePower: ROCKET_IMPACT_OPACITY_FADE_POWER,
      hotBurst: true
    };
  }

  if (isSmallArmsVisualKind(weapon.visualKind)) {
    return {
      expandPeakFraction: SMALL_ARMS_IMPACT_EXPAND_PEAK_FRACTION,
      expandEase: 'cubic',
      opacityFade: SMALL_ARMS_IMPACT_OPACITY_FADE,
      opacityFadePower: SMALL_ARMS_IMPACT_OPACITY_FADE_POWER,
      hotBurst: true
    };
  }

  return {};
}

function resolveImpactBurstStartScale(weapon: WeaponDefinition, endScale: number): number {
  if (weapon.visualKind === 'rocket') {
    return ROCKET_IMPACT_START_SCALE;
  }
  if (weapon.visualKind === 'flak') {
    return Math.max(IMPACT_BURST_START_SCALE, endScale * FLAK_IMPACT_START_SCALE_FRACTION);
  }
  if (isSmallArmsVisualKind(weapon.visualKind)) {
    return Math.max(SMALL_ARMS_IMPACT_START_SCALE_MIN, endScale * SMALL_ARMS_VFX_START_SCALE_FRACTION);
  }
  return IMPACT_BURST_START_SCALE;
}

export function spawnProjectileImpactBurst(
  instancing: SphereInstancingService,
  weapon: WeaponDefinition,
  impact: ImpactProfile,
  position: { x: number; y: number; z: number },
  kind: ImpactBurstKind,
  nowMs: number,
  radiusOverride?: number
): ImpactBurst | null {
  const endScale = resolveImpactVfxRadius(weapon, impact, kind, radiusOverride);
  if (endScale <= 0) {
    return null;
  }

  return instancing.spawnImpactBurst(
    weapon.color,
    position.x,
    position.y,
    position.z,
    endScale,
    resolveImpactBurstDuration(weapon, impact),
    resolveImpactBurstStartScale(weapon, endScale),
    nowMs,
    resolveImpactBurstProfile(weapon, impact)
  );
}

export function updateImpactBurst(
  instancing: SphereInstancingService,
  burst: ImpactBurst,
  nowMs: number
): boolean {
  return instancing.tickImpactBurst(burst, nowMs);
}

export function disposeImpactBurst(instancing: SphereInstancingService, burst: ImpactBurst): void {
  instancing.releaseImpactBurst(burst);
}
