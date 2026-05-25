import type { Vector3 } from 'three/webgpu';
import type { BotBrainIntent } from '../bots/bot-brain';
import type { InputSnapshot } from '../input/input-state';
import {
  fireInputOpen,
  fireProfileForMode,
  fireTriggerFor,
  secondaryFireEnabled,
  weaponHasBioChargeSecondary,
  weaponHasRocketMagazine,
  type WeaponDefinition
} from './weapon-definitions';
import type { WeaponArsenal, WeaponFireGates } from './weapon-arsenal';

export interface FireIntent {
  readonly primary: WeaponFireGates;
  readonly secondary: WeaponFireGates;
  readonly aimYaw: number;
  readonly aimPitch: number;
}

/** Hold / release edges for Bio charge and Rocket volley (player RMB or bot equivalent). */
export interface SecondaryHoldGates {
  readonly pressed: boolean;
  readonly held: boolean;
  readonly released: boolean;
}

export type MutableFireIntent = {
  primary: WeaponFireGates;
  secondary: WeaponFireGates;
  aimYaw: number;
  aimPitch: number;
};

export type MutableSecondaryHoldGates = {
  pressed: boolean;
  held: boolean;
  released: boolean;
};

export const IDLE_FIRE_INTENT: FireIntent = {
  primary: { held: false, pressed: false },
  secondary: { held: false, pressed: false },
  aimYaw: 0,
  aimPitch: 0
};

export const IDLE_SECONDARY_HOLD: SecondaryHoldGates = {
  pressed: false,
  held: false,
  released: false
};

/** Player render loop — one scratch reused every frame. */
export const PLAYER_FIRE_INTENT_SCRATCH: MutableFireIntent = {
  primary: { held: false, pressed: false },
  secondary: { held: false, pressed: false },
  aimYaw: 0,
  aimPitch: 0
};

export const PLAYER_SECONDARY_HOLD_SCRATCH: MutableSecondaryHoldGates = {
  pressed: false,
  held: false,
  released: false
};

const _primaryGateScratch: WeaponFireGates = { held: false, pressed: false };

/** Bio/Rocket RMB — hold-release path, not tap-to-fire gates. */
export function weaponUsesHoldSecondary(weapon: WeaponDefinition): boolean {
  return weaponHasBioChargeSecondary(weapon) || weaponHasRocketMagazine(weapon);
}

function fillSnapshotFireGates(
  snapshot: InputSnapshot,
  channel: 'primary' | 'secondary',
  out: WeaponFireGates
): void {
  if (channel === 'primary') {
    out.held = snapshot.primaryHeld;
    out.pressed = snapshot.primaryPressed;
    return;
  }

  out.held = snapshot.secondaryHeld;
  out.pressed = snapshot.secondaryPressed;
}

/** LMB and RMB cannot fire the same frame — primary wins. Semi held alone does not block the other button. */
function applyExclusiveFireIntent(intent: MutableFireIntent, weapon: WeaponDefinition): void {
  const primaryActive = fireInputOpen(weapon.primary, intent.primary);
  const secondaryActive =
    secondaryFireEnabled(weapon) && fireInputOpen(weapon.secondary, intent.secondary);
  if (!primaryActive || !secondaryActive) {
    return;
  }

  intent.secondary.held = false;
  intent.secondary.pressed = false;
}

function fillBotFireGates(
  wants: boolean,
  auto: boolean,
  brainStepped: boolean,
  out: WeaponFireGates
): void {
  if (auto) {
    out.held = wants;
    out.pressed = false;
    return;
  }

  out.held = false;
  out.pressed = wants && brainStepped;
}

/** Bot semi: one virtual click per brain step; auto: sustained hold. */
export function botFireGates(wants: boolean, auto: boolean, brainStepped: boolean): WeaponFireGates {
  fillBotFireGates(wants, auto, brainStepped, _primaryGateScratch);
  return _primaryGateScratch;
}

/** @deprecated Use `fillBotFireGates` */
export function fireGates(wantsFire: boolean, auto: boolean): WeaponFireGates {
  return botFireGates(wantsFire, auto, true);
}

/** @deprecated Use `fillBotFireGates` */
export const primaryFireGates = (wantsFire: boolean, auto: boolean): WeaponFireGates =>
  botFireGates(wantsFire, auto, true);

export function fillFireIntentFromBrain(
  intent: BotBrainIntent,
  weapon: WeaponDefinition,
  brainStepped: boolean,
  aimYaw: number,
  aimPitch: number,
  out: MutableFireIntent
): FireIntent {
  const wants = intent.wantsFire;
  const autoPrimary = fireTriggerFor(weapon.primary) === 'auto';
  const autoSecondary = fireTriggerFor(weapon.secondary) === 'auto';
  const holdSecondary = weaponUsesHoldSecondary(weapon) && secondaryFireEnabled(weapon);
  const wantsSecondary = wants && holdSecondary;
  const wantsPrimary = wants && !wantsSecondary;

  fillBotFireGates(wantsPrimary, autoPrimary, brainStepped, out.primary);
  fillBotFireGates(wantsSecondary, autoSecondary, brainStepped, out.secondary);
  out.aimYaw = aimYaw;
  out.aimPitch = aimPitch;
  applyExclusiveFireIntent(out, weapon);
  return out;
}

export function fillSecondaryHoldFromInput(
  snapshot: InputSnapshot,
  weapon: WeaponDefinition,
  out: MutableSecondaryHoldGates
): SecondaryHoldGates {
  _primaryGateScratch.held = snapshot.primaryHeld;
  _primaryGateScratch.pressed = snapshot.primaryPressed;
  if (weaponUsesHoldSecondary(weapon) && fireInputOpen(weapon.primary, _primaryGateScratch)) {
    out.pressed = false;
    out.held = false;
    out.released = false;
    return out;
  }

  out.pressed = snapshot.secondaryPressed;
  out.held = snapshot.secondaryHeld;
  out.released = snapshot.secondaryReleased;
  return out;
}

/** Bot Bio/Rocket hold — begin on first brain step in range, release on drop or auto-complete. */
export function fillSecondaryHoldFromBrain(
  wantsSecondary: boolean,
  brainStepped: boolean,
  holdActive: boolean,
  out: MutableSecondaryHoldGates
): SecondaryHoldGates {
  if (holdActive && !wantsSecondary) {
    out.pressed = false;
    out.held = false;
    out.released = true;
    return out;
  }

  if (wantsSecondary && !holdActive && brainStepped) {
    out.pressed = true;
    out.held = true;
    out.released = false;
    return out;
  }

  if (wantsSecondary && holdActive) {
    out.pressed = false;
    out.held = true;
    out.released = false;
    return out;
  }

  out.pressed = false;
  out.held = false;
  out.released = false;
  return out;
}

export function fillFireIntentFromInput(
  snapshot: InputSnapshot,
  weapon: WeaponDefinition,
  out: MutableFireIntent
): FireIntent {
  fillSnapshotFireGates(snapshot, 'primary', out.primary);
  fillSnapshotFireGates(snapshot, 'secondary', out.secondary);
  out.aimYaw = snapshot.yaw;
  out.aimPitch = snapshot.pitch;
  applyExclusiveFireIntent(out, weapon);
  return out;
}

export function fireGatesOpen(gates: WeaponFireGates): boolean {
  return gates.held || gates.pressed;
}

/** @deprecated Use `fireGatesOpen` */
export const primaryFireOpen = (intent: FireIntent): boolean => fireGatesOpen(intent.primary);

export function applyPrimaryFireIntent(
  weapon: WeaponArsenal,
  intent: FireIntent,
  nowMs: number,
  muzzlePosition: Vector3,
  direction: Vector3,
  enabled = true
): boolean {
  if (!enabled || !fireGatesOpen(intent.primary)) {
    return false;
  }

  return weapon.tryFire('primary', nowMs, muzzlePosition, direction, intent.primary);
}

export function applySecondaryFireIntent(
  weapon: WeaponArsenal,
  intent: FireIntent,
  nowMs: number,
  muzzlePosition: Vector3,
  direction: Vector3,
  enabled = true
): boolean {
  if (!enabled || weapon.isRedeemerGuidedActive() || weapon.isBioChargeHolding()) {
    return false;
  }

  const weaponDef = weapon.selectedWeapon;
  const secondaryFire = fireProfileForMode(weaponDef, 'secondary');
  if (
    !fireInputOpen(secondaryFire, intent.secondary) &&
    !weapon.hasSecondaryBurstPending()
  ) {
    weapon.releaseBeamStream();
    return false;
  }

  return weapon.tryFire('secondary', nowMs, muzzlePosition, direction, intent.secondary);
}

/** Per-frame beam sustain — call from render loop while RMB / bot secondary held. */
export function tickSecondaryBeamHold(
  weapon: WeaponArsenal,
  intent: FireIntent,
  nowMs: number,
  muzzlePosition: Vector3,
  direction: Vector3
): void {
  if (intent.secondary.held && weapon.isBeamStreamSecondarySelected()) {
    weapon.tickBeamStream(nowMs, muzzlePosition, direction);
  }
}

function applyBioSecondaryHold(
  weapon: WeaponArsenal,
  hold: SecondaryHoldGates,
  nowMs: number,
  direction: Vector3,
  muzzlePosition: Vector3,
  firstPerson: boolean
): void {
  if (hold.pressed) {
    weapon.beginBioChargeHold(nowMs, firstPerson);
  }
  if (hold.held) {
    weapon.tickBioCharge(nowMs, firstPerson);
  }
  if (hold.released) {
    weapon.releaseBioCharge(nowMs, direction, muzzlePosition);
  }
}

function applyRocketSecondaryHold(
  weapon: WeaponArsenal,
  hold: SecondaryHoldGates,
  nowMs: number,
  direction: Vector3,
  muzzlePosition: Vector3
): void {
  if (hold.pressed) {
    weapon.beginRocketMarkHold(nowMs);
  }
  if (hold.held) {
    weapon.tickRocketMarking(nowMs);
  }
  if (hold.released) {
    weapon.releaseRocketVolley(nowMs, direction, muzzlePosition);
  }
}

/** Player + bot RMB — Bio/Rocket hold-release, then shared secondary/beam path. */
export function applyCombinedSecondaryIntent(
  weapon: WeaponArsenal,
  intent: FireIntent,
  hold: SecondaryHoldGates,
  nowMs: number,
  muzzlePosition: Vector3,
  direction: Vector3,
  enabled: boolean,
  firstPerson = false
): void {
  if (!enabled || weapon.isRedeemerGuidedActive()) {
    return;
  }

  if (weapon.isBioLobberSelected()) {
    applyBioSecondaryHold(weapon, hold, nowMs, direction, muzzlePosition, firstPerson);
    return;
  }

  if (weapon.isRocketLauncherSelected()) {
    applyRocketSecondaryHold(weapon, hold, nowMs, direction, muzzlePosition);
    return;
  }

  applySecondaryFireIntent(weapon, intent, nowMs, muzzlePosition, direction);
  tickSecondaryBeamHold(weapon, intent, nowMs, muzzlePosition, direction);
}
