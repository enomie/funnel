// Path: /Users/johann/MyBrew/funnel-real/src/combat/weapon-definitions.ts

import {
  shockOrbComboKillRadiusM,
  SHOCK_ORB_COMBO_EXPAND_MS,
  SHOCK_ORB_SOLO_EXPAND_MS,
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


const SHOCK_ORB_PROJECTILE_SCALE = 1.12;
const SHOCK_ORB_SOLO_KILL_M = shockOrbSoloKillRadiusM(SHOCK_ORB_PROJECTILE_SCALE);
const SHOCK_ORB_COMBO_KILL_M = shockOrbComboKillRadiusM(SHOCK_ORB_PROJECTILE_SCALE);


export const DEFAULT_IMPACT_EXPAND_MS = 200;

export const REDEEMER_IMPACT_EXPAND_MS = 3000;

export const BIO_LOBBER_KILL_RADIUS_MIN_M = 1;
export const BIO_LOBBER_KILL_RADIUS_MAX_M = 10;
export const BIO_LOBBER_IMPACT_EXPAND_MAX_MS = 900;

export const FLAK_KILL_RADIUS_M = 2;

export type FireDelivery = 'projectile' | 'hitscan' | 'beamTick' | 'zoom';


export type FireTrigger = 'semi' | 'auto';

export type ProjectileTrajectory = 'linear' | 'ballistic';

export interface FireProfile {
  
  trigger?: FireTrigger;
  
  delivery?: FireDelivery;
  fireIntervalMs: number;
  projectileCount: number;
  spreadRadians: number;
  speed: number;
  damage: number;
  
  hitscanRangeM?: number;
  
  projectileTags?: readonly string[];
  
  trajectory?: ProjectileTrajectory;
  
  lobUpBias?: number;
  
  projectileScale?: number;
  
  projectileColor?: number;
  
  chargeMinMs?: number;
  
  chargeMaxMs?: number;
  
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
  
  impactRadius: number;
  
  impactExpandMs: number;
  ricochetMax: number;
  explodeOnContact: boolean;
  
  stickDelayMs?: number;
  
  childShrapnelCount?: number;
  childShrapnelSpeed?: number;
  childShrapnelSpreadRadians?: number;
  childShrapnelDamage?: number;
  childShrapnelImpactRadius?: number;
  childShrapnelScale?: number;
  
  childShrapnelArcUpBias?: number;
  
  childShrapnelMaxRangeM?: number;
  
  childShrapnelMaxFlightMs?: number;
  
  lethalSplash?: boolean;
  
  expandingLethal?: boolean;
  
  splashFriendlyFire?: boolean;
}

export interface WeaponDefinition {
  slotLabel: string;
  name: string;
  color: number;
  
  width: number;
  length: number;
  height: number;
  visualKind: ProjectileVisualKind;
  primary: FireProfile;
  secondary: FireProfile;
  primaryImpact: ImpactProfile;
  secondaryImpact: ImpactProfile;
  
  secondaryBurstShots?: number;
  secondaryBurstShotIntervalMs?: number;
  
  sniperZoomFovScale?: number;
  
  comboImpact?: ImpactProfile;
  
  barrelCount?: number;
  
  guidedRedeemerSecondary?: boolean;
  
  bioChargeSecondary?: boolean;
  
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

const WEAPON_BY_VISUAL_KIND = new Map<ProjectileVisualKind, WeaponDefinition>();

export function weaponDefinitionForVisualKind(
  visualKind: ProjectileVisualKind
): WeaponDefinition | undefined {
  return WEAPON_BY_VISUAL_KIND.get(visualKind);
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
      impactExpandMs: SHOCK_ORB_SOLO_EXPAND_MS,
      ricochetMax: 0,
      explodeOnContact: true,
      lethalSplash: true,
      expandingLethal: true
    },
    comboImpact: {
      directDamage: 96,
      impactRadius: SHOCK_ORB_COMBO_KILL_M,
      impactExpandMs: SHOCK_ORB_COMBO_EXPAND_MS,
      ricochetMax: 0,
      explodeOnContact: true,
      lethalSplash: true,
      expandingLethal: true
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
      ammoMax: 20,
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

for (const weapon of WEAPON_DEFINITIONS) {
  WEAPON_BY_VISUAL_KIND.set(weapon.visualKind, weapon);
}
