// Path: /Users/johann/MyBrew/funnel-real/src/combat/ammo-controller.ts

import type { AmmoProfile, WeaponDefinition, WeaponFireMode } from './weapon-definitions';

const SNIPER_MAGAZINE_RELOAD_MS = 3500;

export type AmmoCellState = 'empty' | 'filled' | 'chambering' | 'reserved';

export interface AmmoHudSnapshot {
  visible: boolean;
  weaponName: string;
  ammoMax: number;
  ammoCurrent: number;
  weaponColor: number;
  
  reloadProgress: number;
  cellStates: readonly AmmoCellState[];
}

type ActiveReloadKind = 'none' | 'chamber' | 'magazine';

export type { ActiveReloadKind };

export class WeaponAmmoController {
  #profile: AmmoProfile | null = null;
  #current = 0;
  #reloadStartedAtMs = 0;
  #reloadEndsAtMs = 0;
  #reloadDurationMs = 0;
  #activeReload: ActiveReloadKind = 'none';
  #beamStartedAtMs = 0;
  #beamStartAmmo = 0;
  #beamActive = false;
  #reservedCount = 0;
  #bioPreviewCost = 0;
  #lastHudStateKey = '';
  readonly #cachedCellStates: AmmoCellState[] = [];
  readonly #cachedHudSnapshot: AmmoHudSnapshot = {
    visible: false,
    weaponName: '',
    ammoMax: 0,
    ammoCurrent: 0,
    weaponColor: 0,
    reloadProgress: 0,
    cellStates: this.#cachedCellStates
  };
  readonly #reloadMechanicsScratch: {
    startedAtMs: number;
    durationMs: number;
    kind: ActiveReloadKind;
  } = {
    startedAtMs: 0,
    durationMs: 0,
    kind: 'none'
  };

  selectWeapon(weapon: WeaponDefinition): void {
    this.#lastHudStateKey = '';
    const profile = weapon.ammo;
    if (profile === undefined) {
      this.#profile = null;
      this.#current = 0;
      this.#clearReload();
      this.#beamActive = false;
      this.#reservedCount = 0;
      this.#bioPreviewCost = 0;
      return;
    }

    this.#profile = profile;
    this.#current = profile.ammoMax;
    this.#clearReload();
    this.#beamActive = false;
    this.#reservedCount = 0;
    this.#bioPreviewCost = 0;
  }

  tick(nowMs: number): boolean {
    if (this.#profile === null) {
      return false;
    }

    if (this.#reloadEndsAtMs > 0 && nowMs >= this.#reloadEndsAtMs) {
      this.#finishReload();
    }

    if (
      this.#beamActive &&
      this.#profile.beamMaxHoldMs !== undefined &&
      nowMs >= this.#beamStartedAtMs + this.#profile.beamMaxHoldMs
    ) {
      this.#endBeam(nowMs);
      return true;
    }

    return false;
  }

  getHudSnapshot(weapon: WeaponDefinition): AmmoHudSnapshot {
    const stateKey = this.#hudStateKey(weapon);
    if (stateKey === this.#lastHudStateKey) {
      return this.#cachedHudSnapshot;
    }

    this.#lastHudStateKey = stateKey;
    return this.#rebuildHudSnapshot(weapon);
  }

  #hudStateKey(weapon: WeaponDefinition): string {
    const profile = weapon.ammo;
    if (profile === undefined) {
      return `0|${weapon.name}|${String(weapon.color)}`;
    }

    const nowMs = performance.now();
    const ammoCurrent = Math.max(0, Math.min(profile.ammoMax, this.#current));
    let reloadProgressKey = 0;
    if (this.#activeReload === 'magazine' && this.#reloadEndsAtMs > nowMs && this.#reloadDurationMs > 0) {
      const elapsed = nowMs - this.#reloadStartedAtMs;
      const reloadProgress = Math.min(1, Math.max(0, elapsed / this.#reloadDurationMs));
      reloadProgressKey = Math.floor(reloadProgress * 1000);
    }

    const chambering =
      this.#activeReload === 'chamber' && this.#reloadEndsAtMs > nowMs && ammoCurrent < profile.ammoMax
        ? 1
        : 0;
    const beamPreview =
      this.#beamActive && this.#profile !== null
        ? Math.min(this.#beamStartAmmo, pulseBeamAmmoCost(nowMs - this.#beamStartedAtMs, this.#profile))
        : 0;

    return [
      '1',
      weapon.name,
      String(profile.ammoMax),
      String(ammoCurrent),
      String(weapon.color),
      String(reloadProgressKey),
      String(chambering),
      String(this.#bioPreviewCost),
      String(this.#reservedCount),
      String(beamPreview)
    ].join('|');
  }

  #rebuildHudSnapshot(weapon: WeaponDefinition): AmmoHudSnapshot {
    const snapshot = this.#cachedHudSnapshot;
    const profile = weapon.ammo;
    if (profile === undefined) {
      snapshot.visible = false;
      snapshot.weaponName = weapon.name;
      snapshot.ammoMax = 0;
      snapshot.ammoCurrent = 0;
      snapshot.weaponColor = weapon.color;
      snapshot.reloadProgress = 0;
      this.#cachedCellStates.length = 0;
      return snapshot;
    }

    const nowMs = performance.now();
    let reloadProgress = 0;
    if (this.#activeReload === 'magazine' && this.#reloadEndsAtMs > nowMs && this.#reloadDurationMs > 0) {
      const elapsed = nowMs - this.#reloadStartedAtMs;
      reloadProgress = Math.min(1, Math.max(0, elapsed / this.#reloadDurationMs));
    }

    const ammoCurrent = Math.max(0, Math.min(profile.ammoMax, this.#current));
    snapshot.visible = true;
    snapshot.weaponName = weapon.name;
    snapshot.ammoMax = profile.ammoMax;
    snapshot.ammoCurrent = ammoCurrent;
    snapshot.weaponColor = weapon.color;
    snapshot.reloadProgress = reloadProgress;
    this.#buildCellStates(profile.ammoMax, ammoCurrent, nowMs, this.#cachedCellStates);
    return snapshot;
  }

  get current(): number {
    return this.#current;
  }

  isReloading(nowMs: number): boolean {
    return this.#reloadEndsAtMs > nowMs;
  }

  
  hasReloadPending(): boolean {
    return this.#reloadEndsAtMs > 0;
  }

  isChambering(nowMs: number): boolean {
    return this.#activeReload === 'chamber' && this.#reloadEndsAtMs > nowMs;
  }

  get reloadStartedAtMs(): number {
    return this.#reloadStartedAtMs;
  }

  get reloadDurationMs(): number {
    return this.#reloadDurationMs;
  }

  get activeReloadKind(): ActiveReloadKind {
    return this.#activeReload;
  }

  getReloadMechanicsState(): {
    readonly startedAtMs: number;
    readonly durationMs: number;
    readonly kind: ActiveReloadKind;
  } {
    const scratch = this.#reloadMechanicsScratch;
    scratch.startedAtMs = this.#reloadStartedAtMs;
    scratch.durationMs = this.#reloadDurationMs;
    scratch.kind = this.#activeReload;
    return scratch;
  }

  isBeamActive(): boolean {
    return this.#beamActive;
  }

  setReservedCount(count: number): void {
    this.#reservedCount = Math.max(0, count);
  }

  setBioChargePreviewCost(cost: number): void {
    this.#bioPreviewCost = Math.max(0, cost);
  }

  clearBioChargePreview(): void {
    this.#bioPreviewCost = 0;
  }

  fireCost(weapon: WeaponDefinition, mode: WeaponFireMode): number {
    const profile = weapon.ammo;
    if (profile === undefined) {
      return 0;
    }

    if (mode === 'secondary') {
      if (weapon.secondaryBurstShots !== undefined) {
        return 1;
      }

      return profile.secondaryAmmoCost ?? 1;
    }

    return 1;
  }

  canFire(weapon: WeaponDefinition, mode: WeaponFireMode, nowMs: number): boolean {
    const profile = weapon.ammo;
    if (profile === undefined) {
      return true;
    }

    if (this.isReloading(nowMs)) {
      return false;
    }

    if (mode === 'secondary' && profile.reloadKind === 'beamOverheat' && this.#beamActive) {
      return true;
    }

    if (mode === 'secondary' && weapon.secondaryBurstShots !== undefined) {
      return this.#current >= 1;
    }

    const cost = this.fireCost(weapon, mode);
    return this.#current >= cost;
  }

  canConsume(cost: number, nowMs: number): boolean {
    if (this.#profile === null) {
      return true;
    }

    if (this.isReloading(nowMs)) {
      return false;
    }

    return this.#current >= cost;
  }

  
  commitFire(weapon: WeaponDefinition, _mode: WeaponFireMode, nowMs: number, units = 1): void {
    const profile = weapon.ammo;
    if (profile === undefined) {
      return;
    }

    this.#current = Math.max(0, this.#current - units);
    this.#reservedCount = 0;
    this.#bioPreviewCost = 0;

    this.#applyReloadAfterFire(profile, nowMs);
  }

  beginBeam(nowMs: number): void {
    if (this.#profile === null || this.#beamActive) {
      return;
    }

    this.#beamActive = true;
    this.#beamStartedAtMs = nowMs;
    this.#beamStartAmmo = this.#current;
  }

  getRoundsAvailable(): number {
    return Math.max(0, this.#current);
  }

  releaseBeam(nowMs: number): void {
    if (!this.#beamActive || this.#profile === null) {
      return;
    }

    this.#endBeam(nowMs);
  }

  #endBeam(nowMs: number): void {
    if (this.#profile === null) {
      this.#beamActive = false;
      this.#beamStartedAtMs = 0;
      this.#beamStartAmmo = 0;
      return;
    }

    const heldMs = nowMs - this.#beamStartedAtMs;
    const cost = Math.min(this.#beamStartAmmo, pulseBeamAmmoCost(heldMs, this.#profile));
    this.#current = Math.max(0, this.#beamStartAmmo - cost);
    this.#beamActive = false;
    this.#beamStartedAtMs = 0;
    this.#beamStartAmmo = 0;
    this.#applyReloadAfterFire(this.#profile, nowMs);
  }

  #applyReloadAfterFire(profile: AmmoProfile, nowMs: number): void {
    switch (profile.reloadKind) {
      case 'perShot':
        this.#startReload(profile.reloadMs, nowMs, 'magazine');
        break;
      case 'onEmpty':
        if (this.#current <= 0) {
          this.#startReload(profile.reloadMs, nowMs, 'magazine');
        }
        break;
      case 'boltAction':
        if (this.#current <= 0) {
          this.#startReload(SNIPER_MAGAZINE_RELOAD_MS, nowMs, 'magazine');
        } else if (profile.betweenShotReloadMs !== undefined) {
          this.#startReload(profile.betweenShotReloadMs, nowMs, 'chamber');
        }
        break;
      case 'beamOverheat':
        if (this.#current <= 0) {
          this.#startReload(profile.reloadMs, nowMs, 'magazine');
        }
        break;
      default:
        break;
    }
  }

  #buildCellStates(
    ammoMax: number,
    ammoCurrent: number,
    nowMs: number,
    states: AmmoCellState[]
  ): void {
    states.length = 0;
    const chambering =
      this.#activeReload === 'chamber' && this.#reloadEndsAtMs > nowMs && ammoCurrent < ammoMax;
    const beamPreview =
      this.#beamActive && this.#profile !== null
        ? Math.min(this.#beamStartAmmo, pulseBeamAmmoCost(nowMs - this.#beamStartedAtMs, this.#profile))
        : 0;
    const darkenedCount = Math.max(this.#bioPreviewCost, this.#reservedCount, beamPreview);
    const darkenedStart = Math.max(0, ammoCurrent - darkenedCount);

    for (let index = 0; index < ammoMax; index += 1) {
      if (chambering && index === ammoCurrent) {
        states.push('chambering');
        continue;
      }

      if (index < ammoCurrent) {
        states.push(index >= darkenedStart && darkenedCount > 0 ? 'reserved' : 'filled');
        continue;
      }

      states.push('empty');
    }
  }

  #startReload(durationMs: number, nowMs: number, kind: ActiveReloadKind): void {
    if (durationMs <= 0 || this.#profile === null) {
      return;
    }

    this.#reloadDurationMs = durationMs;
    this.#reloadStartedAtMs = nowMs;
    this.#reloadEndsAtMs = nowMs + durationMs;
    this.#activeReload = kind;
  }

  #finishReload(): void {
    if (this.#profile === null) {
      this.#clearReload();
      return;
    }

    this.#current = this.#profile.ammoMax;
    this.#clearReload();
  }

  #clearReload(): void {
    this.#reloadStartedAtMs = 0;
    this.#reloadEndsAtMs = 0;
    this.#reloadDurationMs = 0;
    this.#activeReload = 'none';
  }
}


export function pulseBeamAmmoCost(heldMs: number, profile: AmmoProfile): number {
  const maxHold = profile.beamMaxHoldMs ?? 3000;
  if (maxHold <= 0) {
    return 1;
  }

  return Math.max(1, Math.ceil((heldMs / maxHold) * profile.ammoMax));
}


export function bioChargeAmmoCost(
  fraction: number,
  ammoMax: number,
  available: number
): number {
  const desired = Math.max(1, Math.ceil(fraction * ammoMax));
  return Math.min(Math.max(0, available), desired);
}
