// Path: /Users/johann/MyBrew/funnel-real/src/combat/weapon-arsenal.ts

import type { RigidBody, World } from '@dimforge/rapier3d-simd-compat';
import {
  Object3D,
  Scene,
  Vector3
} from 'three/webgpu';
import {
  configureViewmodelAttachedProjectilePreview,
  createProjectileVisual,
  releaseViewmodelAttachedProjectilePreview,
  resetProjectileTransform,
  syncMuzzleAttachedPreviewPosition
} from './projectile-visuals';
import {
  applyImpact,
  type ApplyImpactDeps,
  type ApplyImpactRequest,
  type CombatImpactSink
} from './apply-impact';
import { BioChargeState } from './bio-charge';
import { IMPACT_GAIN_NORMAL } from '../game-audio/audio-config';
import type { WeaponAudio } from '../game-audio/audio-weapon/audio-weapon';
import type { ChargeHoldMechanicsState } from '../game-audio/audio-weapon/audio-weapon-charge-hold';
import type { SphereInstancingService } from '../render/sphere-instancing';
import type { SegmentLineInstancingService } from '../render/segment-line-instancing';
import { HitscanWeapon, type ShockComboFireContext } from './hitscan-weapon';
import { type ShockOrbRayHit } from './shock-combo';
import type { FactionTeam } from './teams';
import {
  fireDeliveryFor,
  fireInputOpen,
  fireProfileForMode,
  fireTriggerFor,
  impactProfileForMode,
  secondaryFireEnabled,
  weaponHasBioChargeSecondary,
  weaponHasRocketMagazine,
  WEAPON_DEFINITIONS,
  type FireProfile,
  type ImpactProfile,
  type WeaponDefinition,
  type WeaponFireMode
} from './weapon-definitions';
import {
  bioChargeAmmoCost,
  WeaponAmmoController,
  type AmmoHudSnapshot
} from './ammo-controller';
import {
  resolveRocketBarrelSpawn,
  resolveRocketVolleyDirection,
  ROCKET_VOLLEY_SHOT_INTERVAL_MS,
  RocketLauncherMagazine
} from './rocket-launcher';
import {
  applyLobBiasInto,
  eachProjectileDirection,
  type WorldProjectileSim
} from './world-projectile-sim';
import {
  projectileIsGuidedRedeemer,
  type GuidedRedeemerCameraState,
  RedeemerGuidedFlight
} from './redeemer-guided';
import { rollSpawnWeapon, spawnWeaponSlotIndex } from './spawn-weapon-roll';
import { resolveWeaponEngageRangeM } from './weapon-aim';
import {
  registerWorldEffectsSource,
  unregisterWorldEffectsSource,
  type WorldEffectsSource
} from './world-effects-registry';

const SHOCK_COMBO_IMPACT_GAIN = IMPACT_GAIN_NORMAL * 1.75;

export interface WeaponFireGates {
  held: boolean;
  pressed: boolean;
}

export interface WeaponArsenalBudget {
  readonly maxActiveProjectiles: number;
}

const _lobDirectionScratch = new Vector3();
const _shockComboImpactPoint = new Vector3();

export const WEAPON_ARSENAL_PLAYER_BUDGET: WeaponArsenalBudget = {
  maxActiveProjectiles: 96
};

export const WEAPON_ARSENAL_BOT_BUDGET: WeaponArsenalBudget = {
  maxActiveProjectiles: 8
};

export class WeaponArsenal implements WorldEffectsSource {
  readonly #audio: WeaponAudio;
  readonly #projectileSim: WorldProjectileSim;
  readonly #hitscan: HitscanWeapon;
  #selectedSlot = 0;
  #lastPrimaryFireAt = 0;
  #lastSecondaryFireAt = 0;
  #burstShotsRemaining = 0;
  #burstNextShotAt = 0;
  readonly #burstDirection = new Vector3();
  readonly #burstMuzzle = new Vector3();
  #fireStarted = false;
  #rocketVolleyRemaining = 0;
  #rocketVolleyTotal = 0;
  #rocketVolleyShotIndex = 0;
  #rocketVolleyNextAt = 0;
  readonly #rocketVolleyDirection = new Vector3();
  readonly #rocketVolleyMuzzle = new Vector3();
  #rocketVolleyFire: FireProfile | null = null;
  #rocketVolleyImpact: ImpactProfile | null = null;
  readonly #ammo = new WeaponAmmoController();
  readonly #rocketMagazine = new RocketLauncherMagazine();
  readonly #redeemerGuided = new RedeemerGuidedFlight();
  readonly #bioCharge = new BioChargeState();
  #bioChargePreview: Object3D | null = null;
  readonly #barrelSpawnScratch = new Vector3();
  readonly #volleyDirectionScratch = new Vector3();
  readonly #volleySpawnScratch = new Vector3();
  readonly #mechanicsAudioOrigin = new Vector3();
  readonly #chargeHoldMechanicsScratch: {
    rocketMarking: boolean;
    rocketMarkedCount: number;
    bioHolding: boolean;
    bioChargeFraction: number;
  } = {
    rocketMarking: false,
    rocketMarkedCount: 0,
    bioHolding: false,
    bioChargeFraction: 0
  };
  readonly #beamHoldMechanicsScratch: {
    active: boolean;
    heatFraction: number;
  } = {
    active: false,
    heatFraction: 0
  };
  readonly #guidedCameraScratch: GuidedRedeemerCameraState = {
    position: new Vector3(),
    lookAt: new Vector3(),
    direction: new Vector3()
  };
  readonly #impactDeps: ApplyImpactDeps;
  readonly #sourceFaction: () => FactionTeam;
  readonly #sourceActorId: string;
  readonly #bioChargePreviewParent: Object3D;
  readonly #impactSink: CombatImpactSink;
  #combatNowMs = 0;
  readonly #impactScratch: ApplyImpactRequest = {
    sourceFaction: 'alpha',
    sourceActorId: '',
    impact: { directDamage: 0, impactRadius: 0, impactExpandMs: 0, ricochetMax: 0, explodeOnContact: false },
    point: new Vector3(),
    nowMs: 0
  };
  readonly #shockComboContext: ShockComboFireContext = {
    orbs: [],
    onComboHit: (hit) => {
      this.#resolveShockCombo(hit);
    }
  };

  constructor(
    scene: Scene,
    world: World,
    ignoredRigidBody: RigidBody,
    weaponAudio: WeaponAudio,
    impactDeps: ApplyImpactDeps,
    sourceFaction: () => FactionTeam,
    sourceActorId: string,
    bioChargePreviewParent: Object3D,
    projectileSim: WorldProjectileSim,
    budget: WeaponArsenalBudget = WEAPON_ARSENAL_PLAYER_BUDGET,
    sphereInstancing: SphereInstancingService | null = null,
    segmentLines: SegmentLineInstancingService | null = null
  ) {
    this.#audio = weaponAudio;
    this.#projectileSim = projectileSim;
    this.#impactDeps = impactDeps;
    this.#sourceFaction = sourceFaction;
    this.#sourceActorId = sourceActorId;
    this.#bioChargePreviewParent = bioChargePreviewParent;
    this.#impactSink = {
      apply: (request) => {
        const scratch = this.#impactScratch;
        scratch.sourceFaction = this.#sourceFaction();
        scratch.sourceActorId = this.#sourceActorId;
        scratch.sourceWeaponVisualKind = request.sourceWeaponVisualKind;
        scratch.impact = request.impact;
        scratch.point = request.point;
        scratch.hitCollider = request.hitCollider;
        scratch.nowMs = request.nowMs;
        applyImpact(this.#impactDeps, scratch);
      }
    };
    this.#hitscan = new HitscanWeapon(
      scene,
      world,
      ignoredRigidBody,
      weaponAudio,
      this.#impactSink,
      sphereInstancing,
      segmentLines
    );
    this.#ammo.selectWeapon(this.selectedWeapon);
    this.#projectileSim.registerBridge({
      ownerId: sourceActorId,
      ignoredBody: ignoredRigidBody,
      maxActive: budget.maxActiveProjectiles,
      sourceFaction,
      impactSink: this.#impactSink,
      resolveShockCombo: (hit) => {
        this.#resolveShockCombo(hit);
      }
    });
    registerWorldEffectsSource(this);
  }

  prepareWorldTickContext(aim?: { readonly yaw: number; readonly pitch: number }): void {
    this.#projectileSim.setOwnerAim(this.#sourceActorId, aim);
  }

  getAmmoHudSnapshot(nowMs: number): AmmoHudSnapshot {
    return this.#ammo.getHudSnapshot(this.selectedWeapon, nowMs);
  }

  get selectedWeapon(): WeaponDefinition {
    return WEAPON_DEFINITIONS[this.#selectedSlot] ?? WEAPON_DEFINITIONS[0];
  }

  get selectedSlotIndex(): number {
    return this.#selectedSlot;
  }

  get selectedWeaponLabel(): string {
    const weapon = this.selectedWeapon;
    return `${weapon.slotLabel} ${weapon.name}`;
  }

  selectSlot(slot: number): boolean {
    const nextSlot = Math.max(0, Math.min(WEAPON_DEFINITIONS.length - 1, slot));
    if (nextSlot === this.#selectedSlot) {
      return false;
    }

    this.#selectedSlot = nextSlot;
    this.#clearPistolBurst();
    this.#hitscan.releaseBeamStream();
    this.#audio.stopReloadMechanics();
    this.#ammo.selectWeapon(this.selectedWeapon);
    this.#syncRocketMagazineForSelectedWeapon();
    this.#redeemerGuided.end();
    this.#clearBioCharge();
    return true;
  }

  equipSpawnWeapon(): WeaponDefinition {
    return this.equipWeapon(rollSpawnWeapon());
  }

  equipWeapon(weapon: WeaponDefinition): WeaponDefinition {
    this.#selectedSlot = spawnWeaponSlotIndex(weapon);
    this.#clearPistolBurst();
    this.#hitscan.releaseBeamStream();
    this.#audio.stopReloadMechanics();
    this.#ammo.selectWeapon(this.selectedWeapon);
    this.#syncRocketMagazineForSelectedWeapon();
    this.#redeemerGuided.end();
    this.#clearBioCharge();
    return this.selectedWeapon;
  }

  get fireRangeM(): number {
    return resolveWeaponEngageRangeM(this.selectedWeapon.primary);
  }

  canFirePrimary(nowMs: number): boolean {
    return this.#ammo.canFire(this.selectedWeapon, 'primary', nowMs);
  }

  trackMechanicsAudioOrigin(position: Vector3): void {
    this.#mechanicsAudioOrigin.copy(position);
  }

  
  needsMechanicsAudioTick(nowMs: number): boolean {
    if (this.#bioCharge.isHolding || this.#rocketMagazine.isMarking || this.#ammo.isBeamActive()) {
      return true;
    }

    if (this.#ammo.isReloading(nowMs)) {
      return true;
    }

    const reloadState = this.#ammo.getReloadMechanicsState();
    if (
      reloadState.kind !== 'none' &&
      nowMs < reloadState.startedAtMs + reloadState.durationMs
    ) {
      return true;
    }

    return this.#audio.hasActiveMechanicsVoice();
  }

  tickMechanicsAudio(nowMs: number): void {
    this.#audio.syncReloadMechanics(
      this.selectedWeapon,
      this.#mechanicsAudioOrigin,
      this.#ammo.getReloadMechanicsState(),
      nowMs
    );
    this.#audio.syncChargeHoldMechanics(
      this.#mechanicsAudioOrigin,
      this.#fillChargeHoldMechanics(nowMs)
    );
    this.#audio.syncBeamHoldMechanics(
      this.#mechanicsAudioOrigin,
      this.#fillBeamHoldMechanics(nowMs)
    );
  }

  #fillBeamHoldMechanics(nowMs: number): { active: boolean; heatFraction: number } {
    const scratch = this.#beamHoldMechanicsScratch;
    scratch.active = this.#ammo.isBeamActive();
    scratch.heatFraction = this.#ammo.peekBeamHeatFraction(nowMs);
    return scratch;
  }

  #fillChargeHoldMechanics(nowMs: number): ChargeHoldMechanicsState {
    const scratch = this.#chargeHoldMechanicsScratch;
    scratch.rocketMarking = this.#rocketMagazine.isMarking;
    scratch.rocketMarkedCount = this.#rocketMagazine.markedCount;
    scratch.bioHolding = this.#bioCharge.isHolding;
    scratch.bioChargeFraction = this.peekBioChargeFraction(nowMs);
    return scratch;
  }

  isReloading(nowMs: number): boolean {
    return this.#ammo.isReloading(nowMs);
  }

  needsWorldTick(_nowMs: number): boolean {
    return (
      this.#burstShotsRemaining > 0 ||
      this.#rocketVolleyRemaining > 0 ||
      this.#bioCharge.isHolding ||
      this.#rocketMagazine.isMarking ||
      this.#redeemerGuided.isActive ||
      this.#ammo.isBeamActive() ||
      this.#ammo.hasReloadPending() ||
      this.#hitscan.needsWorldTick()
    );
  }

  consumeFireStarted(): boolean {
    const started = this.#fireStarted;
    this.#fireStarted = false;
    return started;
  }

  releaseBeamStream(nowMs: number): void {
    this.#ammo.releaseBeam(nowMs);
    this.#hitscan.releaseBeamStream();
  }

  suspendCombat(nowMs: number): void {
    this.#combatNowMs = nowMs;
    this.releaseBeamStream(nowMs);
    this.#audio.stopReloadMechanics();
    this.#clearBioCharge();
    this.#rocketMagazine.cancelMarkHold();
    this.#clearPistolBurst();
    this.#clearRocketVolley();
    this.#redeemerGuided.end();
    this.#hitscan.releaseAllEffects();
    this.#projectileSim.releaseOwner(this.#sourceActorId);
  }

  releaseAllWorldEffects(): void {
    this.suspendCombat(this.#combatNowMs);
    this.#projectileSim.unregisterBridge(this.#sourceActorId);
    unregisterWorldEffectsSource(this);
  }

  isBeamStreamSecondarySelected(): boolean {
    return fireDeliveryFor(this.selectedWeapon.secondary) === 'beamTick';
  }

  tickBeamStream(nowMs: number, muzzlePosition: Vector3, direction: Vector3): void {
    const weapon = this.selectedWeapon;
    const fire = weapon.secondary;
    if (fireDeliveryFor(fire) !== 'beamTick') {
      return;
    }

    if (!this.#ammo.isBeamActive() && !this.#ammo.canFire(weapon, 'secondary', nowMs)) {
      return;
    }

    if (!this.#ammo.isBeamActive()) {
      this.#ammo.beginBeam(nowMs);
    }

    this.#hitscan.tickBeamStream(weapon, fire, weapon.secondaryImpact, muzzlePosition, direction, nowMs);
  }

  isRedeemerGuidedActive(): boolean {
    return this.#redeemerGuided.isActive;
  }

  resolveGuidedRedeemerCamera(): GuidedRedeemerCameraState | null {
    return this.#redeemerGuided.resolveCamera(this.#guidedCameraScratch);
  }

  isRocketLauncherSelected(): boolean {
    return weaponHasRocketMagazine(this.selectedWeapon);
  }

  isBioLobberSelected(): boolean {
    return weaponHasBioChargeSecondary(this.selectedWeapon);
  }

  isBioChargeHolding(): boolean {
    return this.#bioCharge.isHolding;
  }

  isRocketMarking(): boolean {
    return this.#rocketMagazine.isMarking;
  }

  isRocketVolleyPending(): boolean {
    return this.#rocketVolleyRemaining > 0;
  }

  get rocketMarkedCount(): number {
    return this.#rocketMagazine.markedCount;
  }

  roundsAvailable(): number {
    return this.#ammo.getRoundsAvailable();
  }

  peekBioChargeFraction(nowMs: number): number {
    if (!this.isBioLobberSelected() || !this.#bioCharge.isHolding) {
      return 0;
    }

    const weapon = this.selectedWeapon;
    return this.#bioCharge.snapshot(nowMs, weapon.secondary, weapon.secondaryImpact).fraction;
  }

  beginBioChargeHold(nowMs: number, firstPerson: boolean): void {
    if (!this.isBioLobberSelected()) {
      return;
    }

    const weapon = this.selectedWeapon;
    const fire = weapon.secondary;
    if (nowMs < this.#lastSecondaryFireAt + fire.fireIntervalMs) {
      return;
    }

    if (!this.#ammo.canFire(weapon, 'secondary', nowMs)) {
      return;
    }

    this.#bioCharge.beginHold(nowMs);
    const ammoMax = weapon.ammo?.ammoMax ?? 10;
    this.#ammo.setBioChargePreviewCost(bioChargeAmmoCost(0, ammoMax, this.#ammo.current));
    this.#ensureBioChargePreview(weapon);
    const charge = this.#bioCharge.snapshot(nowMs, weapon.secondary, weapon.secondaryImpact);
    this.#syncBioChargePreview(charge.projectileScale, firstPerson);
  }

  tickBioCharge(nowMs: number, firstPerson: boolean): void {
    if (!this.#bioCharge.isHolding || !this.isBioLobberSelected()) {
      return;
    }

    const weapon = this.selectedWeapon;
    const charge = this.#bioCharge.snapshot(nowMs, weapon.secondary, weapon.secondaryImpact);
    const ammoMax = weapon.ammo?.ammoMax ?? 10;
    this.#ammo.setBioChargePreviewCost(
      bioChargeAmmoCost(charge.fraction, ammoMax, this.#ammo.current)
    );
    this.#syncBioChargePreview(charge.projectileScale, firstPerson);
  }

  releaseBioCharge(
    nowMs: number,
    direction: Vector3,
    muzzlePosition: Vector3
  ): boolean {
    if (!this.isBioLobberSelected()) {
      this.#clearBioCharge();
      return false;
    }

    if (!this.#bioCharge.isHolding) {
      return false;
    }

    const weapon = this.selectedWeapon;
    if (!this.#ammo.canFire(weapon, 'secondary', nowMs)) {
      this.#clearBioCharge();
      return false;
    }

    const baseFire = weapon.secondary;
    const baseImpact = weapon.secondaryImpact;
    if (nowMs < this.#lastSecondaryFireAt + baseFire.fireIntervalMs) {
      this.#clearBioCharge();
      return false;
    }

    const charge = this.#bioCharge.snapshot(nowMs, baseFire, baseImpact);
    const ammoMax = weapon.ammo?.ammoMax ?? 10;
    const ammoCost = bioChargeAmmoCost(charge.fraction, ammoMax, this.#ammo.current);
    if (!this.#ammo.canConsume(ammoCost, nowMs)) {
      this.#clearBioCharge();
      return false;
    }

    this.#clearBioCharge();
    this.#lastSecondaryFireAt = nowMs;
    this.#fireChargedBioBlob(weapon, baseFire, baseImpact, charge, direction, muzzlePosition, nowMs);
    this.#ammo.commitFire(weapon, 'secondary', nowMs, ammoCost);
    return true;
  }

  beginRocketMarkHold(nowMs: number): void {
    if (!this.isRocketLauncherSelected()) {
      return;
    }

    this.#rocketMagazine.beginMarkHold(nowMs);
  }

  tickRocketMarking(nowMs: number): void {
    if (!this.isRocketLauncherSelected()) {
      return;
    }

    this.#rocketMagazine.tickMarkWhileHeld(nowMs, this.#ammo.getRoundsAvailable());
  }

  releaseRocketVolley(
    nowMs: number,
    direction: Vector3,
    muzzlePosition: Vector3
  ): boolean {
    if (!this.isRocketLauncherSelected()) {
      return false;
    }

    const weapon = this.selectedWeapon;
    const fire = weapon.secondary;
    const ammoAvailable = this.#ammo.getRoundsAvailable();
    const count = this.#rocketMagazine.peekVolleyCount(ammoAvailable);
    if (count <= 0) {
      this.#rocketMagazine.cancelMarkHold();
      return false;
    }

    if (nowMs < this.#lastSecondaryFireAt + fire.fireIntervalMs) {
      this.#rocketMagazine.cancelMarkHold();
      return false;
    }

    const marked = this.#rocketMagazine.commitVolley();
    const fired = Math.min(marked, ammoAvailable);
    if (fired <= 0) {
      return false;
    }

    this.#lastSecondaryFireAt = nowMs;
    this.#ammo.commitFire(weapon, 'secondary', nowMs, fired);
    this.#rocketVolleyRemaining = fired;
    this.#rocketVolleyTotal = fired;
    this.#rocketVolleyShotIndex = 0;
    this.#rocketVolleyNextAt = nowMs;
    this.#rocketVolleyFire = fire;
    this.#rocketVolleyImpact = weapon.secondaryImpact;
    this.#rocketVolleyDirection.copy(direction);
    this.#rocketVolleyMuzzle.copy(muzzlePosition);
    this.#tickRocketVolley(nowMs);
    return true;
  }

  hasSecondaryBurstPending(): boolean {
    return this.#burstShotsRemaining > 0;
  }

  tickWorld(nowMs: number, _deltaSeconds: number, _shedNonCritical = false): void {
    this.#combatNowMs = nowMs;
    this.#hitscan.update(nowMs);
    if (this.#ammo.tick(nowMs)) {
      this.releaseBeamStream(nowMs);
    }
    if (this.isRocketLauncherSelected()) {
      this.#ammo.setReservedCount(this.#rocketMagazine.markedCount);
    } else {
      this.#ammo.setReservedCount(0);
    }
    this.#updateGuidedRedeemer(nowMs);
    if (this.#rocketVolleyRemaining > 0) {
      this.#tickRocketVolley(nowMs);
    }
    if (this.#burstShotsRemaining > 0) {
      this.#tickPistolBurst(nowMs, this.#burstDirection, this.#burstMuzzle);
    }
  }

  tryFire(
    mode: WeaponFireMode,
    nowMs: number,
    muzzlePosition: Vector3,
    direction: Vector3,
    gates: WeaponFireGates
  ): boolean {
    this.#combatNowMs = nowMs;
    const weapon = this.selectedWeapon;
    this.#noteMechanicsAudioOrigin(muzzlePosition);

    if (this.#redeemerGuided.isActive || this.#bioCharge.isHolding) {
      return false;
    }

    if (!this.#ammo.canFire(weapon, mode, nowMs)) {
      this.#tryDryFireClick(weapon, mode, nowMs, muzzlePosition, gates);
      return false;
    }

    if (mode === 'primary' && weaponHasRocketMagazine(weapon)) {
      return this.#tryFireRocketPrimary(nowMs, direction, muzzlePosition, gates);
    }

    if (mode === 'secondary') {
      if (weaponHasRocketMagazine(weapon) || weaponHasBioChargeSecondary(weapon)) {
        return false;
      }

      this.#tickPistolBurst(nowMs, direction, muzzlePosition);
      if (!this.#shouldAttemptSecondaryFire(weapon, gates)) {
        return this.#burstShotsRemaining > 0;
      }
      if (weapon.secondaryBurstShots !== undefined) {
        return this.#tryStartPistolBurst(nowMs, direction, muzzlePosition);
      }
    } else if (!this.#fireInputOpen(fireProfileForMode(weapon, 'primary'), gates)) {
      return false;
    }

    const fire = fireProfileForMode(weapon, mode);
    const impact = impactProfileForMode(weapon, mode);
    const lastFireAt = mode === 'primary' ? this.#lastPrimaryFireAt : this.#lastSecondaryFireAt;
    if (nowMs < lastFireAt + fire.fireIntervalMs) {
      return false;
    }

    if (fire.delivery === 'beamTick' && this.#ammo.isBeamActive()) {
      return true;
    }

    if (mode === 'primary') {
      this.#lastPrimaryFireAt = nowMs;
    } else {
      this.#lastSecondaryFireAt = nowMs;
    }

    this.#emitFireVolley(weapon, fire, impact, direction, muzzlePosition, mode, nowMs);
    this.#commitAmmoAfterFire(weapon, fire, mode, nowMs);
    this.#fireStarted = true;
    return true;
  }

  #shouldAttemptSecondaryFire(weapon: WeaponDefinition, gates: WeaponFireGates): boolean {
    if (this.#burstShotsRemaining > 0) {
      return true;
    }

    if (weapon.secondaryBurstShots !== undefined) {
      return gates.pressed;
    }

    if (!secondaryFireEnabled(weapon)) {
      return false;
    }

    return this.#fireInputOpen(weapon.secondary, gates);
  }

  #fireInputOpen(fire: FireProfile, gates: WeaponFireGates): boolean {
    return fireInputOpen(fire, gates);
  }

  #noteMechanicsAudioOrigin(position: Vector3): void {
    this.#mechanicsAudioOrigin.copy(position);
  }

  #tryDryFireClick(
    weapon: WeaponDefinition,
    mode: WeaponFireMode,
    nowMs: number,
    muzzlePosition: Vector3,
    gates: WeaponFireGates
  ): void {
    if (weapon.ammo === undefined || !gates.pressed) {
      return;
    }

    if (mode === 'secondary' && (weaponHasRocketMagazine(weapon) || weaponHasBioChargeSecondary(weapon))) {
      return;
    }

    const fire = fireProfileForMode(weapon, mode);
    if (!this.#fireInputOpen(fire, gates) && fireTriggerFor(fire) !== 'auto') {
      return;
    }

    const cost = this.#ammo.fireCost(weapon, mode);
    const empty = this.#ammo.current < cost;
    const reloading = this.#ammo.isReloading(nowMs);
    if (!empty && !reloading) {
      return;
    }

    this.#audio.playEmptyClick(weapon, muzzlePosition, nowMs);
  }

  #tryStartPistolBurst(nowMs: number, direction: Vector3, muzzlePosition: Vector3): boolean {
    const weapon = this.selectedWeapon;
    const fire = weapon.secondary;
    if (nowMs < this.#lastSecondaryFireAt + fire.fireIntervalMs) {
      return false;
    }

    const maxBurst = weapon.secondaryBurstShots ?? 3;
    const burstShots = Math.min(maxBurst, this.#ammo.current);
    if (burstShots <= 0 || !this.#ammo.canConsume(1, nowMs)) {
      return false;
    }

    this.#lastSecondaryFireAt = nowMs;
    this.#ammo.commitFire(weapon, 'secondary', nowMs, burstShots);
    this.#burstShotsRemaining = burstShots;
    this.#burstNextShotAt = nowMs;
    this.#burstDirection.copy(direction);
    this.#burstMuzzle.copy(muzzlePosition);
    this.#tickPistolBurst(nowMs, direction, muzzlePosition);
    this.#fireStarted = true;
    return true;
  }

  #tickPistolBurst(nowMs: number, direction: Vector3, _muzzlePosition: Vector3): void {
    if (this.#burstShotsRemaining <= 0 || this.selectedWeapon.secondaryBurstShots === undefined) {
      return;
    }

    const weapon = this.selectedWeapon;
    const fire = weapon.secondary;
    const impact = weapon.secondaryImpact;
    const burstDirection = this.#burstShotsRemaining > 0 ? this.#burstDirection : direction;
    const shotInterval = weapon.secondaryBurstShotIntervalMs ?? 52;

    while (
      this.#burstShotsRemaining > 0 &&
      nowMs >= this.#burstNextShotAt &&
      this.selectedWeapon.slotLabel === weapon.slotLabel
    ) {
      this.#emitFireVolley(weapon, fire, impact, burstDirection, this.#burstMuzzle, 'secondary', nowMs);
      this.#burstShotsRemaining -= 1;
      this.#burstNextShotAt = nowMs + shotInterval;
    }

    if (this.#burstShotsRemaining <= 0) {
      this.#clearPistolBurst();
    }
  }

  #clearPistolBurst(): void {
    this.#burstShotsRemaining = 0;
  }

  #syncRocketMagazineForSelectedWeapon(): void {
    const weapon = this.selectedWeapon;
    if (weapon.barrelCount !== undefined) {
      this.#rocketMagazine.reset(weapon.barrelCount);
      return;
    }

    this.#rocketMagazine.clear();
  }

  #commitAmmoAfterFire(
    weapon: WeaponDefinition,
    fire: FireProfile,
    mode: WeaponFireMode,
    nowMs: number
  ): void {
    if (fire.delivery === 'beamTick') {
      if (!this.#ammo.isBeamActive()) {
        this.#ammo.beginBeam(nowMs);
      }
      return;
    }

    this.#ammo.commitFire(weapon, mode, nowMs, this.#ammo.fireCost(weapon, mode));
  }

  #updateGuidedRedeemer(nowMs: number): void {
    if (!this.#redeemerGuided.isActive) {
      return;
    }

    const id = this.#redeemerGuided.projectileId;
    if (!this.#projectileSim.hasProjectile(id)) {
      this.#redeemerGuided.end();
      return;
    }

    if (this.#redeemerGuided.isExpired(nowMs)) {
      this.#projectileSim.detonateById(id);
      this.#redeemerGuided.end();
    }
  }

  #tryFireRocketPrimary(
    nowMs: number,
    direction: Vector3,
    muzzlePosition: Vector3,
    gates: WeaponFireGates
  ): boolean {
    const weapon = this.selectedWeapon;
    const ammoAvailable = this.#ammo.getRoundsAvailable();
    if (!this.#fireInputOpen(weapon.primary, gates) || !this.#rocketMagazine.canFirePrimary(ammoAvailable)) {
      return false;
    }

    const fire = weapon.primary;
    if (nowMs < this.#lastPrimaryFireAt + fire.fireIntervalMs) {
      return false;
    }

    const barrelIndex = this.#rocketMagazine.consumePrimaryRound();
    if (barrelIndex < 0) {
      return false;
    }

    this.#lastPrimaryFireAt = nowMs;
    this.#ammo.commitFire(weapon, 'primary', nowMs, 1);
    const barrelCount = weapon.barrelCount ?? 6;
    const spawnPosition = resolveRocketBarrelSpawn(
      muzzlePosition,
      direction,
      barrelIndex,
      barrelCount,
      this.#barrelSpawnScratch
    );
    this.#emitRocketShot(weapon, fire, weapon.primaryImpact, direction, spawnPosition, muzzlePosition, nowMs);
    this.#fireStarted = true;
    return true;
  }

  #emitRocketShot(
    weapon: WeaponDefinition,
    fire: FireProfile,
    impact: ImpactProfile,
    direction: Vector3,
    spawnPosition: Vector3,
    audioPosition: Vector3,
    nowMs: number
  ): void {
    this.#audio.playFire(weapon, audioPosition, fire, impact);
    this.#spawnProjectile(weapon, fire, impact, direction, spawnPosition, nowMs);
  }

  #emitRocketVolleyShot(
    weapon: WeaponDefinition,
    fire: FireProfile,
    impact: ImpactProfile,
    direction: Vector3,
    muzzlePosition: Vector3,
    shotIndex: number,
    totalCount: number,
    barrelIndex: number,
    nowMs: number
  ): void {
    const barrelCount = weapon.barrelCount ?? 6;
    const spawnPosition = resolveRocketBarrelSpawn(
      muzzlePosition,
      direction,
      barrelIndex,
      barrelCount,
      this.#volleySpawnScratch
    );
    const shotDirection = resolveRocketVolleyDirection(
      direction,
      shotIndex,
      totalCount,
      fire.spreadRadians,
      this.#volleyDirectionScratch
    );
    this.#audio.playFire(weapon, spawnPosition, fire, impact);
    this.#spawnProjectile(weapon, fire, impact, shotDirection, spawnPosition, nowMs);
  }

  #tickRocketVolley(nowMs: number): void {
    if (this.#rocketVolleyRemaining <= 0 || !this.isRocketLauncherSelected()) {
      this.#clearRocketVolley();
      return;
    }

    const weapon = this.selectedWeapon;
    const fire = this.#rocketVolleyFire;
    const impact = this.#rocketVolleyImpact;
    if (fire === null || impact === null) {
      this.#clearRocketVolley();
      return;
    }

    const barrelCount = weapon.barrelCount ?? 6;
    while (
      this.#rocketVolleyRemaining > 0 &&
      nowMs >= this.#rocketVolleyNextAt
    ) {
      this.#emitRocketVolleyShot(
        weapon,
        fire,
        impact,
        this.#rocketVolleyDirection,
        this.#rocketVolleyMuzzle,
        this.#rocketVolleyShotIndex,
        this.#rocketVolleyTotal,
        this.#rocketVolleyShotIndex % barrelCount,
        nowMs
      );
      this.#rocketVolleyShotIndex += 1;
      this.#rocketVolleyRemaining -= 1;
      this.#rocketVolleyNextAt = nowMs + ROCKET_VOLLEY_SHOT_INTERVAL_MS;
    }

    if (this.#rocketVolleyRemaining <= 0) {
      this.#clearRocketVolley();
    }
  }

  #clearRocketVolley(): void {
    this.#rocketVolleyRemaining = 0;
    this.#rocketVolleyTotal = 0;
    this.#rocketVolleyShotIndex = 0;
    this.#rocketVolleyNextAt = 0;
    this.#rocketVolleyFire = null;
    this.#rocketVolleyImpact = null;
  }

  #fireChargedBioBlob(
    weapon: WeaponDefinition,
    baseFire: FireProfile,
    baseImpact: ImpactProfile,
    charge: {
      projectileScale: number;
      damage: number;
      impactRadius: number;
      impactExpandMs: number;
      stickDelayMs: number;
    },
    direction: Vector3,
    muzzlePosition: Vector3,
    nowMs: number
  ): void {
    const fire: FireProfile = {
      ...baseFire,
      projectileScale: charge.projectileScale,
      damage: charge.damage
    };
    const impact: ImpactProfile = {
      ...baseImpact,
      directDamage: charge.damage,
      impactRadius: charge.impactRadius,
      impactExpandMs: charge.impactExpandMs,
      stickDelayMs: charge.stickDelayMs
    };

    this.#audio.playFire(weapon, muzzlePosition, fire, impact);

    const lobBias = fire.lobUpBias;
    const shotDirection =
      lobBias !== undefined && lobBias > 0
        ? applyLobBiasInto(direction, lobBias, _lobDirectionScratch)
        : direction;
    this.#spawnProjectile(weapon, fire, impact, shotDirection, muzzlePosition, nowMs);
  }

  #ensureBioChargePreview(weapon: WeaponDefinition): void {
    if (this.#bioChargePreview !== null) {
      return;
    }

    this.#bioChargePreview = createProjectileVisual(weapon.visualKind, weapon.color);
    configureViewmodelAttachedProjectilePreview(this.#bioChargePreview);
    this.#bioChargePreviewParent.add(this.#bioChargePreview);
  }

  #syncBioChargePreview(visualScale: number, firstPerson: boolean): void {
    if (this.#bioChargePreview === null) {
      return;
    }

    const weapon = this.selectedWeapon;
    resetProjectileTransform(this.#bioChargePreview);
    this.#bioChargePreview.scale.setScalar(visualScale);
    syncMuzzleAttachedPreviewPosition(
      this.#bioChargePreview,
      weapon.visualKind,
      visualScale,
      firstPerson
    );
  }

  #clearBioCharge(): void {
    this.#bioCharge.cancelHold();
    this.#ammo.clearBioChargePreview();
    if (this.#bioChargePreview !== null) {
      releaseViewmodelAttachedProjectilePreview(this.#bioChargePreview);
      this.#bioChargePreview = null;
    }
  }

  #refreshShockComboContext(): ShockComboFireContext {
    this.#shockComboContext.orbs = this.#projectileSim.listShockOrbs(this.#sourceActorId);
    return this.#shockComboContext;
  }

  #resolveShockCombo(hit: ShockOrbRayHit): void {
    const weapon = this.#projectileSim.removeShockOrbWeapon(hit.projectileId);
    if (weapon === null) {
      return;
    }

    const comboImpact = weapon.comboImpact;
    if (comboImpact === undefined) {
      return;
    }

    _shockComboImpactPoint.set(hit.x, hit.y, hit.z);
    this.#audio.playImpact(weapon, _shockComboImpactPoint, SHOCK_COMBO_IMPACT_GAIN, comboImpact);
    this.#projectileSim.spawnOwnerLethalDetonation(
      this.#sourceActorId,
      weapon,
      comboImpact,
      _shockComboImpactPoint,
      this.#combatNowMs,
      SHOCK_COMBO_IMPACT_GAIN
    );
  }

  #emitFireVolley(
    weapon: WeaponDefinition,
    fire: FireProfile,
    impact: ImpactProfile,
    direction: Vector3,
    muzzlePosition: Vector3,
    _mode: WeaponFireMode,
    nowMs: number
  ): void {
    const delivery = fireDeliveryFor(fire);
    if (delivery === 'beamTick') {
      return;
    }

    if (delivery === 'hitscan') {
      const shockCombo =
        weapon.comboImpact !== undefined ? this.#refreshShockComboContext() : undefined;
      this.#hitscan.fireVolley(weapon, fire, impact, direction, muzzlePosition, nowMs, shockCombo);
      return;
    }

    this.#audio.playFire(weapon, muzzlePosition, fire, impact);

    eachProjectileDirection(
      direction,
      fire.projectileCount,
      fire.spreadRadians,
      (shotDirection) => {
        const lobBias = fire.lobUpBias;
        const resolvedDirection =
          lobBias !== undefined && lobBias > 0
            ? applyLobBiasInto(shotDirection, lobBias, _lobDirectionScratch)
            : shotDirection;
        this.#spawnProjectile(weapon, fire, impact, resolvedDirection, muzzlePosition, nowMs);
      }
    );
  }

  #spawnProjectile(
    weapon: WeaponDefinition,
    fire: FireProfile,
    impact: ImpactProfile,
    direction: Vector3,
    muzzlePosition: Vector3,
    nowMs: number
  ): void {
    const id = this.#projectileSim.spawn(
      this.#sourceActorId,
      weapon,
      fire,
      impact,
      direction,
      muzzlePosition,
      nowMs
    );
    if (id < 0) {
      return;
    }

    const tags = fire.projectileTags ?? [];
    if (projectileIsGuidedRedeemer(tags)) {
      this.#redeemerGuided.begin(this.#projectileSim, id, nowMs);
    }
  }
}
