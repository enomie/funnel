import {
  shockOrbComboKillRadiusM,
  shockOrbSoloKillRadiusM
} from './shock-combo';

export type ProjectileVisualKind =
  | 'pistol'
  | 'shock'
  | 'rocket'
  | 'ripper'
  | 'flak'
  | 'sniper'
  | 'gatling'
  | 'pulse'
  | 'bio'
  | 'redeemer';

export type WeaponFireMode = 'primary' | 'secondary';

/** Shock RMB orb — keep in sync with `secondary.projectileScale` below. */
const SHOCK_ORB_PROJECTILE_SCALE = 1.12;
const SHOCK_ORB_SOLO_KILL_M = shockOrbSoloKillRadiusM(SHOCK_ORB_PROJECTILE_SCALE);
const SHOCK_ORB_COMBO_KILL_M = shockOrbComboKillRadiusM(SHOCK_ORB_PROJECTILE_SCALE);

/** Default sphere expansion time for small impacts (ms). */
export const DEFAULT_IMPACT_EXPAND_MS = 200;
/** Redeemer nuke — synced with expanding lethal damage + spread audio. */
export const REDEEMER_IMPACT_EXPAND_MS = 3000;
/** Bio Lobber — lethal splash radius (LMB fixed, RMB charge min→max). */
export const BIO_LOBBER_KILL_RADIUS_MIN_M = 1;
export const BIO_LOBBER_KILL_RADIUS_MAX_M = 10;
export const BIO_LOBBER_IMPACT_EXPAND_MAX_MS = 900;
/** Flak LMB pellets, RMB grenade pop, and splitters — lethal splash (VFX capped separately). */
export const FLAK_KILL_RADIUS_M = 2;

export type FireDelivery = 'projectile' | 'hitscan' | 'beamTick' | 'zoom';

/** `semi` = one shot per LMB/RMB press; `auto` = repeat while held (Gatling, Pulse stream). */
export type FireTrigger = 'semi' | 'auto';

export type ProjectileTrajectory = 'linear' | 'ballistic';

export interface FireProfile {
  /** Default `semi`. */
  trigger?: FireTrigger;
  /** Default `projectile`. `beamTick` = short-range hitscan stream (Pulse RMB). */
  delivery?: FireDelivery;
  fireIntervalMs: number;
  projectileCount: number;
  spreadRadians: number;
  speed: number;
  damage: number;
  /** Hitscan / beamTick ray length (m). Falls back to `speed` when > 0, else arena default. */
  hitscanRangeM?: number;
  /** Shock orb etc. — Phase 3 combo listens for these tags. */
  projectileTags?: readonly string[];
  /** `ballistic` uses `PHYSICS_CONFIG.gravity` each frame (Flak grenade, Bio lob). */
  trajectory?: ProjectileTrajectory;
  /** Extra world +Y on initial aim before normalize (arc lobs). */
  lobUpBias?: number;
  /** Multiplier on `projectile-visuals` radius (Bio LMB clumps vs RMB blob). */
  projectileScale?: number;
  /** Override weapon tint for this fire mode. */
  projectileColor?: number;
  /** Bio RMB: hold time before charge ramp begins (ms). */
  chargeMinMs?: number;
  /** Bio RMB: hold time for full charge (ms). */
  chargeMaxMs?: number;
  /** Bio RMB: fraction of max `projectileScale` at minimum charge. */
  chargeMinScale?: number;
}

export type AmmoReloadKind =
  | 'perShot'
  | 'onEmpty'
  | 'boltAction'
  | 'beamOverheat';

export interface AmmoProfile {
  ammoMax: number;
  reloadMs: number;
  reloadKind: AmmoReloadKind;
  betweenShotReloadMs?: number;
  secondaryAmmoCost?: number;
  secondaryBurstAmmoCost?: number;
  beamMaxHoldMs?: number;
}

export interface ImpactProfile {
  directDamage: number;
  /** Max splash radius / impact sphere size (m). Drives VFX end scale and AoE when > 0. */
  impactRadius: number;
  /** Time (ms) for the impact sphere to grow to `impactRadius`. */
  impactExpandMs: number;
  ricochetMax: number;
  explodeOnContact: boolean;
  /** Bio-style: stick at surface, then detonate after delay (ms). */
  stickDelayMs?: number;
  /** Flak grenade: on impact spawn N shrapnel bolts that explode separately (RMB). */
  childShrapnelCount?: number;
  childShrapnelSpeed?: number;
  childShrapnelSpreadRadians?: number;
  childShrapnelDamage?: number;
  childShrapnelImpactRadius?: number;
  childShrapnelScale?: number;
  /** Low hop off surface (world +Y), then gravity. */
  childShrapnelArcUpBias?: number;
  /** Max travel from split point (meters). */
  childShrapnelMaxRangeM?: number;
  /** Force pop after this many ms in flight. */
  childShrapnelMaxFlightMs?: number;
  /** Everyone within `impactRadius` dies (no splash falloff). */
  lethalSplash?: boolean;
  /** Lethal damage front expands with the impact sphere over `impactExpandMs` (Redeemer). */
  expandingLethal?: boolean;
  /** Splash (and direct hit) ignores team — Redeemer nuke. */
  splashFriendlyFire?: boolean;
}

export interface WeaponDefinition {
  slotLabel: string;
  name: string;
  color: number;
  /** Placeholder box only (meters): X = width, Y = height, Z = barrel length along player +Z. */
  width: number;
  length: number;
  height: number;
  visualKind: ProjectileVisualKind;
  primary: FireProfile;
  secondary: FireProfile;
  primaryImpact: ImpactProfile;
  secondaryImpact: ImpactProfile;
  /** Pistol alt-fire: tap RMB fires N rounds with `secondaryBurstShotIntervalMs` spacing. */
  secondaryBurstShots?: number;
  secondaryBurstShotIntervalMs?: number;
  /** Sniper RMB: multiply base FOV while `secondaryHeld` (e.g. 0.38 ≈ scope). */
  sniperZoomFovScale?: number;
  /** Shock LMB beam hits RMB orb (`shock-combo.ts`). */
  comboImpact?: ImpactProfile;
  /** Rocket Launcher: rotating barrel sockets for LMB spawn offsets. */
  barrelCount?: number;
  /** Redeemer RMB: camera follows projectile while steering (`redeemer-guided.ts`). */
  guidedRedeemerSecondary?: boolean;
  /** Bio RMB: hold at muzzle → scale blob, release to lob (`bio-charge.ts`). */
  bioChargeSecondary?: boolean;
  /** Slots 1–9: magazine + reload (`ammo-controller.ts`). */
  ammo?: AmmoProfile;
}

export function weaponHasRocketMagazine(weapon: WeaponDefinition): boolean {
  return weapon.barrelCount !== undefined;
}

export function weaponHasAmmo(weapon: WeaponDefinition): boolean {
  return weapon.ammo !== undefined;
}

export function weaponHasGuidedRedeemerSecondary(weapon: WeaponDefinition): boolean {
  return weapon.guidedRedeemerSecondary === true;
}

export function weaponHasBioChargeSecondary(weapon: WeaponDefinition): boolean {
  return weapon.bioChargeSecondary === true;
}

export function fireDeliveryFor(fire: FireProfile): FireDelivery {
  return fire.delivery ?? 'projectile';
}

export function fireTriggerFor(fire: FireProfile): FireTrigger {
  return fire.trigger ?? 'semi';
}

export interface FireInputGates {
  readonly held: boolean;
  readonly pressed: boolean;
}

/** Semi = edge (`pressed`); auto = sustain (`held`). */
export function fireInputOpen(fire: FireProfile, gates: FireInputGates): boolean {
  return fireTriggerFor(fire) === 'auto' ? gates.held : gates.pressed;
}

export function secondaryFireEnabled(weapon: WeaponDefinition): boolean {
  return fireDeliveryFor(weapon.secondary) !== 'zoom';
}

export function fireProfileForMode(weapon: WeaponDefinition, mode: WeaponFireMode): FireProfile {
  return mode === 'primary' ? weapon.primary : weapon.secondary;
}

export function impactProfileForMode(weapon: WeaponDefinition, mode: WeaponFireMode): ImpactProfile {
  return mode === 'primary' ? weapon.primaryImpact : weapon.secondaryImpact;
}

function impactFromFire(
  fire: FireProfile,
  impactRadius: number,
  impactExpandMs: number,
  ricochetMax = 0,
  explodeOnContact = false,
  stickDelayMs?: number
): ImpactProfile {
  return {
    directDamage: fire.damage,
    impactRadius,
    impactExpandMs,
    ricochetMax,
    explodeOnContact,
    stickDelayMs
  };
}

export const WEAPON_DEFINITIONS: readonly WeaponDefinition[] = [
  {
    slotLabel: '1',
    name: 'Pistol',
    color: 0xffc35a,
    width: 0.05,
    length: 0.268,
    height: 0.12,
    visualKind: 'pistol',
    primary: {
      fireIntervalMs: 180,
      projectileCount: 1,
      spreadRadians: 0,
      speed: 92,
      damage: 22
    },
    secondary: {
      fireIntervalMs: 420,
      projectileCount: 1,
      spreadRadians: 0.09,
      speed: 88,
      damage: 18
    },
    primaryImpact: impactFromFire(
      { fireIntervalMs: 0, projectileCount: 1, spreadRadians: 0, speed: 0, damage: 22 },
      0.13,
      180
    ),
    secondaryImpact: impactFromFire(
      { fireIntervalMs: 0, projectileCount: 1, spreadRadians: 0, speed: 0, damage: 18 },
      0.14,
      180
    ),
    secondaryBurstShots: 3,
    secondaryBurstShotIntervalMs: 52,
    ammo: {
      ammoMax: 12,
      reloadMs: 700,
      reloadKind: 'onEmpty',
      secondaryBurstAmmoCost: 3
    }
  },
  {
    slotLabel: '2',
    name: 'Shock Blaster',
    color: 0x6ff7ff,
    width: 0.11,
    length: 0.612,
    height: 0.16,
    visualKind: 'shock',
    primary: {
      delivery: 'hitscan',
      fireIntervalMs: 120,
      projectileCount: 1,
      spreadRadians: 0,
      speed: 132,
      damage: 48,
      hitscanRangeM: 220
    },
    secondary: {
      delivery: 'projectile',
      fireIntervalMs: 720,
      projectileCount: 1,
      spreadRadians: 0.01,
      speed: 16,
      damage: 52,
      projectileScale: SHOCK_ORB_PROJECTILE_SCALE,
      projectileTags: ['shock-orb']
    },
    primaryImpact: impactFromFire(
      { fireIntervalMs: 0, projectileCount: 1, spreadRadians: 0, speed: 0, damage: 48 },
      0.28,
      220
    ),
    secondaryImpact: {
      directDamage: 52,
      impactRadius: SHOCK_ORB_SOLO_KILL_M,
      impactExpandMs: 400,
      ricochetMax: 0,
      explodeOnContact: true,
      lethalSplash: true
    },
    comboImpact: {
      directDamage: 96,
      impactRadius: SHOCK_ORB_COMBO_KILL_M,
      impactExpandMs: 420,
      ricochetMax: 0,
      explodeOnContact: true,
      lethalSplash: true
    },
    ammo: {
      ammoMax: 15,
      reloadMs: 1000,
      reloadKind: 'onEmpty'
    }
  },
  {
    slotLabel: '3',
    name: 'Rocket Launcher',
    color: 0xff5a1f,
    width: 0.16,
    length: 0.916,
    height: 0.2,
    visualKind: 'rocket',
    primary: {
      fireIntervalMs: 520,
      projectileCount: 1,
      spreadRadians: 0,
      speed: 34,
      damage: 84
    },
    primaryImpact: {
      ...impactFromFire(
        { fireIntervalMs: 0, projectileCount: 1, spreadRadians: 0, speed: 0, damage: 84 },
        5,
        480,
        0,
        true
      ),
      lethalSplash: true
    },
    barrelCount: 6,
    ammo: {
      ammoMax: 6,
      reloadMs: 3000,
      reloadKind: 'onEmpty'
    },
    secondary: {
      fireIntervalMs: 640,
      projectileCount: 1,
      spreadRadians: 0.032,
      speed: 34,
      damage: 84
    },
    secondaryImpact: {
      ...impactFromFire(
        { fireIntervalMs: 0, projectileCount: 1, spreadRadians: 0, speed: 0, damage: 84 },
        5,
        480,
        0,
        true
      ),
      lethalSplash: true
    }
  },
  {
    slotLabel: '4',
    name: 'Ripper',
    color: 0xff4ecb,
    width: 0.12,
    length: 0.552,
    height: 0.14,
    visualKind: 'ripper',
    primary: {
      fireIntervalMs: 260,
      projectileCount: 1,
      spreadRadians: 0,
      speed: 76,
      damage: 100,
      projectileScale: 0.76
    },
    secondary: {
      fireIntervalMs: 340,
      projectileCount: 1,
      spreadRadians: 0.012,
      speed: 52,
      damage: 100,
      projectileScale: 1.42
    },
    primaryImpact: impactFromFire(
      { fireIntervalMs: 0, projectileCount: 1, spreadRadians: 0, speed: 0, damage: 100 },
      0.2,
      240,
      5
    ),
    secondaryImpact: impactFromFire(
      { fireIntervalMs: 0, projectileCount: 1, spreadRadians: 0, speed: 0, damage: 100 },
      0.2,
      240,
      5
    ),
    ammo: {
      ammoMax: 6,
      reloadMs: 2000,
      reloadKind: 'onEmpty',
      secondaryAmmoCost: 2
    }
  },
  {
    slotLabel: '5',
    name: 'Flak Cannon',
    color: 0xff8d3b,
    width: 0.2,
    length: 0.818,
    height: 0.18,
    visualKind: 'flak',
    primary: {
      fireIntervalMs: 320,
      projectileCount: 6,
      spreadRadians: 0.06,
      speed: 58,
      damage: 28
    },
    secondary: {
      fireIntervalMs: 720,
      projectileCount: 1,
      spreadRadians: 0.02,
      speed: 38,
      damage: 42,
      trajectory: 'ballistic',
      lobUpBias: 0.42,
      projectileScale: 1.15
    },
    primaryImpact: {
      directDamage: 28,
      impactRadius: FLAK_KILL_RADIUS_M,
      impactExpandMs: DEFAULT_IMPACT_EXPAND_MS,
      ricochetMax: 0,
      explodeOnContact: true,
      lethalSplash: true
    },
    secondaryImpact: {
      directDamage: 0,
      impactRadius: FLAK_KILL_RADIUS_M,
      impactExpandMs: DEFAULT_IMPACT_EXPAND_MS,
      ricochetMax: 0,
      explodeOnContact: true,
      lethalSplash: true,
      childShrapnelCount: 4,
      childShrapnelSpeed: 15,
      childShrapnelSpreadRadians: 0.42,
      childShrapnelDamage: 15,
      childShrapnelImpactRadius: FLAK_KILL_RADIUS_M,
      childShrapnelScale: 0.62,
      childShrapnelArcUpBias: 0.11,
      childShrapnelMaxRangeM: 4.2,
      childShrapnelMaxFlightMs: 620
    },
    ammo: {
      ammoMax: 8,
      reloadMs: 1100,
      reloadKind: 'onEmpty'
    }
  },
  {
    slotLabel: '6',
    name: 'Sniper Rifle',
    color: 0xd9f6ff,
    width: 0.06,
    length: 1.11,
    height: 0.11,
    visualKind: 'sniper',
    primary: {
      fireIntervalMs: 900,
      projectileCount: 1,
      spreadRadians: 0,
      speed: 168,
      damage: 110
    },
    secondary: {
      delivery: 'zoom',
      fireIntervalMs: 0,
      projectileCount: 0,
      spreadRadians: 0,
      speed: 0,
      damage: 0
    },
    primaryImpact: impactFromFire(
      { fireIntervalMs: 0, projectileCount: 1, spreadRadians: 0, speed: 0, damage: 110 },
      0.18,
      DEFAULT_IMPACT_EXPAND_MS
    ),
    secondaryImpact: impactFromFire(
      { fireIntervalMs: 0, projectileCount: 1, spreadRadians: 0, speed: 0, damage: 0 },
      0,
      DEFAULT_IMPACT_EXPAND_MS
    ),
    sniperZoomFovScale: 0.38,
    ammo: {
      ammoMax: 5,
      reloadMs: 3500,
      reloadKind: 'onEmpty'
    }
  },
  {
    slotLabel: '7',
    name: 'Gatling',
    color: 0xb6ff57,
    width: 0.18,
    length: 0.958,
    height: 0.16,
    visualKind: 'gatling',
    primary: {
      trigger: 'auto',
      fireIntervalMs: 72,
      projectileCount: 1,
      spreadRadians: 0.025,
      speed: 120,
      damage: 11
    },
    secondary: {
      trigger: 'auto',
      fireIntervalMs: 48,
      projectileCount: 1,
      spreadRadians: 0.075,
      speed: 120,
      damage: 11
    },
    primaryImpact: impactFromFire(
      { fireIntervalMs: 0, projectileCount: 1, spreadRadians: 0, speed: 0, damage: 11 },
      0.1,
      160
    ),
    secondaryImpact: impactFromFire(
      { fireIntervalMs: 0, projectileCount: 1, spreadRadians: 0, speed: 0, damage: 11 },
      0.11,
      160
    ),
    ammo: {
      ammoMax: 30,
      reloadMs: 5000,
      reloadKind: 'onEmpty'
    }
  },
  {
    slotLabel: '8',
    name: 'Pulse Lance',
    color: 0x4dffad,
    width: 0.09,
    length: 0.712,
    height: 0.13,
    visualKind: 'pulse',
    primary: {
      trigger: 'auto',
      fireIntervalMs: 140,
      projectileCount: 1,
      spreadRadians: 0.01,
      speed: 70,
      damage: 24
    },
    primaryImpact: impactFromFire(
      { fireIntervalMs: 0, projectileCount: 1, spreadRadians: 0, speed: 0, damage: 24 },
      0.18,
      DEFAULT_IMPACT_EXPAND_MS
    ),
    secondary: {
      trigger: 'auto',
      delivery: 'beamTick',
      fireIntervalMs: 42,
      projectileCount: 1,
      spreadRadians: 0,
      speed: 0,
      damage: 9,
      hitscanRangeM: 26
    },
    secondaryImpact: impactFromFire(
      { fireIntervalMs: 0, projectileCount: 1, spreadRadians: 0, speed: 0, damage: 9 },
      0.12,
      DEFAULT_IMPACT_EXPAND_MS
    ),
    ammo: {
      ammoMax: 10,
      reloadMs: 2000,
      reloadKind: 'beamOverheat',
      beamMaxHoldMs: 3000
    }
  },
  {
    slotLabel: '9',
    name: 'Bio Lobber',
    color: 0x8dff31,
    width: 0.14,
    length: 0.654,
    height: 0.18,
    visualKind: 'bio',
    primary: {
      fireIntervalMs: 320,
      projectileCount: 1,
      spreadRadians: 0.035,
      speed: 38,
      damage: 26,
      trajectory: 'ballistic',
      lobUpBias: 0.3,
      projectileScale: 0.5
    },
    bioChargeSecondary: true,
    secondary: {
      fireIntervalMs: 900,
      projectileCount: 1,
      spreadRadians: 0.01,
      speed: 30,
      damage: 88,
      trajectory: 'ballistic',
      lobUpBias: 0.38,
      projectileScale: 1.45,
      chargeMinMs: 160,
      chargeMaxMs: 1200,
      chargeMinScale: 0.52
    },
    primaryImpact: {
      ...impactFromFire(
        { fireIntervalMs: 0, projectileCount: 1, spreadRadians: 0, speed: 0, damage: 26 },
        BIO_LOBBER_KILL_RADIUS_MIN_M,
        320,
        0,
        true,
        2600
      ),
      lethalSplash: true
    },
    secondaryImpact: {
      ...impactFromFire(
        { fireIntervalMs: 0, projectileCount: 1, spreadRadians: 0, speed: 0, damage: 88 },
        BIO_LOBBER_KILL_RADIUS_MAX_M,
        BIO_LOBBER_IMPACT_EXPAND_MAX_MS,
        0,
        true,
        3800
      ),
      lethalSplash: true
    },
    ammo: {
      ammoMax: 10,
      reloadMs: 2000,
      reloadKind: 'onEmpty'
    }
  },
  {
    slotLabel: '0',
    name: 'Redeemer Seed',
    color: 0xffe66d,
    width: 0.22,
    length: 1.09,
    height: 0.24,
    visualKind: 'redeemer',
    primary: {
      fireIntervalMs: 1100,
      projectileCount: 1,
      spreadRadians: 0,
      speed: 22,
      damage: 135
    },
    primaryImpact: {
      ...impactFromFire(
        { fireIntervalMs: 0, projectileCount: 1, spreadRadians: 0, speed: 0, damage: 135 },
        50,
        REDEEMER_IMPACT_EXPAND_MS,
        0,
        true
      ),
      lethalSplash: true,
      expandingLethal: true,
      splashFriendlyFire: true
    },
    guidedRedeemerSecondary: true,
    secondary: {
      fireIntervalMs: 1400,
      projectileCount: 1,
      spreadRadians: 0,
      speed: 28,
      damage: 135,
      projectileTags: ['redeemer-guided']
    },
    secondaryImpact: {
      ...impactFromFire(
        { fireIntervalMs: 0, projectileCount: 1, spreadRadians: 0, speed: 0, damage: 135 },
        50,
        REDEEMER_IMPACT_EXPAND_MS,
        0,
        true
      ),
      lethalSplash: true,
      expandingLethal: true,
      splashFriendlyFire: true
    },
    ammo: {
      ammoMax: 1,
      reloadMs: 30000,
      reloadKind: 'perShot'
    }
  }
] as const;
