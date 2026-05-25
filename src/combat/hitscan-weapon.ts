// Path: /Users/johann/MyBrew/funnel-real/src/combat/hitscan-weapon.ts

import RAPIER from '@dimforge/rapier3d-simd-compat';
import type { Collider, RigidBody, World } from '@dimforge/rapier3d-simd-compat';
import { Scene, Vector3 } from 'three/webgpu';
import { ACTOR_RAY_QUERY_GROUPS } from '../physics/collision-groups';
import {
  createBeamStreamVisual,
  disposeBeamStreamVisual,
  updateBeamStreamVisual,
  type BeamStreamVisual
} from './beam-stream-visual';
import {
  disposeImpactBurst,
  spawnProjectileImpactBurst,
  updateImpactBurst,
  type ImpactBurst
} from './projectile-impact-visual';
import { IMPACT_GAIN_NORMAL } from '../game-audio/audio-config';
import type { WeaponAudio } from '../game-audio/audio-weapon/audio-weapon';
import { WEAPON_CONFIG } from '../config/game-config';
import { findFirstShockOrbAlongRay, type ShockOrbRayHit, type ShockOrbTarget } from './shock-combo';
import type { CombatImpactRequest, CombatImpactSink } from './apply-impact';
import type { FireProfile, ImpactProfile, WeaponDefinition } from './weapon-definitions';
import type { SphereInstancingService } from '../render/sphere-instancing';
import type { SegmentLineInstancingService } from '../render/segment-line-instancing';
import { eachProjectileDirection } from './world-projectile-sim';

export interface ShockComboFireContext {
  orbs: readonly ShockOrbTarget[];
  onComboHit: (hit: ShockOrbRayHit) => void;
}

const BEAM_IMPACT_GAIN = IMPACT_GAIN_NORMAL * 0.42;
const BEAM_IMPACT_INTERVAL_MS = 96;
const MAX_HITSCAN_IMPACT_BURSTS = 48;

const MUZZLE_RAY_ORIGIN_NUDGE = 0.08;

let _hitscanCastRay: RAPIER.Ray | null = null;

function hitscanCastRay(origin: Vector3, direction: Vector3): RAPIER.Ray {
  if (_hitscanCastRay === null) {
    _hitscanCastRay = new RAPIER.Ray(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: direction.x, y: direction.y, z: direction.z }
    );
    return _hitscanCastRay;
  }

  _hitscanCastRay.origin.x = origin.x;
  _hitscanCastRay.origin.y = origin.y;
  _hitscanCastRay.origin.z = origin.z;
  _hitscanCastRay.dir.x = direction.x;
  _hitscanCastRay.dir.y = direction.y;
  _hitscanCastRay.dir.z = direction.z;
  return _hitscanCastRay;
}

export class HitscanWeapon {
  readonly #scene: Scene;
  readonly #world: World;
  readonly #ignoredRigidBody: RigidBody;
  readonly #audio: WeaponAudio;
  readonly #impactBursts: ImpactBurst[] = [];
  readonly #rayOrigin = new Vector3();
  readonly #rayDirection = new Vector3();
  readonly #hitPoint = new Vector3();
  #beamStream: BeamStreamVisual | null = null;
  #beamStreamColor: number | null = null;
  #lastBeamImpactAt = 0;
  readonly #impactSink: CombatImpactSink | null;
  readonly #sphereInstancing: SphereInstancingService | null;
  readonly #segmentLines: SegmentLineInstancingService | null;
  readonly #impactScratch: CombatImpactRequest;

  constructor(
    scene: Scene,
    world: World,
    ignoredRigidBody: RigidBody,
    weaponAudio: WeaponAudio,
    impactSink: CombatImpactSink | null = null,
    sphereInstancing: SphereInstancingService | null = null,
    segmentLines: SegmentLineInstancingService | null = null
  ) {
    this.#scene = scene;
    this.#world = world;
    this.#ignoredRigidBody = ignoredRigidBody;
    this.#audio = weaponAudio;
    this.#impactSink = impactSink;
    this.#sphereInstancing = sphereInstancing;
    this.#segmentLines = segmentLines;
    this.#impactScratch = {
      impact: {
        directDamage: 0,
        impactRadius: 0,
        impactExpandMs: 0,
        ricochetMax: 0,
        explodeOnContact: false
      },
      point: this.#hitPoint
    };
  }

  update(_nowMs: number): void {
    if (this.#sphereInstancing === null) {
      return;
    }

    const nowMs = performance.now();
    for (let index = this.#impactBursts.length - 1; index >= 0; index -= 1) {
      const burst = this.#impactBursts[index];
      if (!updateImpactBurst(this.#sphereInstancing, burst, nowMs)) {
        continue;
      }
      const lastIndex = this.#impactBursts.length - 1;
      this.#impactBursts[index] = this.#impactBursts[lastIndex];
      this.#impactBursts.length = lastIndex;
    }
  }

  needsWorldTick(): boolean {
    return this.#impactBursts.length > 0 || this.#beamStream !== null;
  }

  releaseAllEffects(): void {
    this.releaseBeamStream();
    if (this.#sphereInstancing !== null) {
      for (const burst of this.#impactBursts) {
        disposeImpactBurst(this.#sphereInstancing, burst);
      }
    }
    this.#impactBursts.length = 0;
  }

  releaseBeamStream(): void {
    if (this.#beamStream === null) {
      return;
    }

    disposeBeamStreamVisual(this.#beamStream, this.#scene);
    this.#beamStream = null;
    this.#beamStreamColor = null;
    this.#lastBeamImpactAt = 0;
  }

  
  tickBeamStream(
    weapon: WeaponDefinition,
    fire: FireProfile,
    impact: ImpactProfile,
    muzzlePosition: Vector3,
    direction: Vector3
  ): void {
    const range = resolveHitscanRange(fire);
    this.#prepareHitscanRay(muzzlePosition, direction);
    const hit = this.#raycastWorld(range);
    const nowMs = performance.now();
    if (hit !== null && nowMs >= this.#lastBeamImpactAt + BEAM_IMPACT_INTERVAL_MS) {
        this.#audio.playImpact(weapon, this.#hitPoint, BEAM_IMPACT_GAIN, impact);
        this.#spawnImpact(weapon, this.#hitPoint, 'hit', impact, nowMs);
      if (this.#impactSink !== null) {
        this.#commitImpact(impact, hit.collider);
      }
      this.#lastBeamImpactAt = nowMs;
    }
    this.#updateBeamStream(weapon.color, muzzlePosition, this.#hitPoint);
  }

  fireVolley(
    weapon: WeaponDefinition,
    fire: FireProfile,
    impact: ImpactProfile,
    direction: Vector3,
    muzzlePosition: Vector3,
    shockCombo?: ShockComboFireContext
  ): void {
    this.#audio.playFire(weapon, muzzlePosition, fire, impact);

    const range = resolveHitscanRange(fire);

    eachProjectileDirection(
      direction,
      fire.projectileCount,
      fire.spreadRadians,
      (shotDirection) => {
        this.#fireRay(weapon, impact, muzzlePosition, shotDirection, range, fire, shockCombo);
      }
    );
  }

  #fireRay(
    weapon: WeaponDefinition,
    impact: ImpactProfile,
    muzzlePosition: Vector3,
    direction: Vector3,
    range: number,
    fire: FireProfile,
    shockCombo?: ShockComboFireContext
  ): void {
    this.#prepareHitscanRay(muzzlePosition, direction);

    if (shockCombo !== undefined && shockCombo.orbs.length > 0) {
      const orbHit = findFirstShockOrbAlongRay(
        this.#rayOrigin,
        this.#rayDirection,
        range,
        shockCombo.orbs
      );
      if (orbHit !== null) {
        shockCombo.onComboHit(orbHit);
        this.#hitPoint.copy(orbHit.point);
        this.#spawnTracer(muzzlePosition, this.#hitPoint, weapon.color, WEAPON_CONFIG.tracerDurationMs);
        return;
      }
    }

    const hit = this.#raycastWorld(range);

    if (hit !== null) {
      const nowMs = performance.now();
      const impactGain = fire.delivery === 'beamTick' ? BEAM_IMPACT_GAIN : IMPACT_GAIN_NORMAL;
      if (
        fire.delivery !== 'beamTick' ||
        nowMs >= this.#lastBeamImpactAt + BEAM_IMPACT_INTERVAL_MS
      ) {
        this.#audio.playImpact(weapon, this.#hitPoint, impactGain, impact);
        this.#spawnImpact(weapon, this.#hitPoint, 'hit', impact, nowMs);
        this.#commitImpact(impact, hit.collider);
        this.#lastBeamImpactAt = nowMs;
      }
    }

    if (fire.delivery === 'beamTick') {
      this.#updateBeamStream(weapon.color, muzzlePosition, this.#hitPoint);
      return;
    }

    this.#spawnTracer(muzzlePosition, this.#hitPoint, weapon.color, WEAPON_CONFIG.tracerDurationMs);
  }

  #prepareHitscanRay(muzzlePosition: Vector3, direction: Vector3): void {
    this.#rayDirection.copy(direction).normalize();
    this.#rayOrigin
      .copy(muzzlePosition)
      .addScaledVector(this.#rayDirection, MUZZLE_RAY_ORIGIN_NUDGE);
  }

  #commitImpact(impact: ImpactProfile, hitCollider: Collider | undefined): void {
    if (this.#impactSink === null) {
      return;
    }

    const scratch = this.#impactScratch;
    scratch.impact = impact;
    scratch.hitCollider = hitCollider;
    this.#impactSink.apply(scratch);
  }

  
  #raycastWorld(range: number): RAPIER.RayColliderHit | null {
    const ray = hitscanCastRay(this.#rayOrigin, this.#rayDirection);
    const hit = this.#world.castRay(
      ray,
      range,
      true,
      undefined,
      ACTOR_RAY_QUERY_GROUPS,
      undefined,
      this.#ignoredRigidBody
    );

    if (hit === null) {
      this.#hitPoint.copy(this.#rayOrigin).addScaledVector(this.#rayDirection, range);
      return null;
    }

    const impactPoint = ray.pointAt(hit.timeOfImpact);
    this.#hitPoint.set(impactPoint.x, impactPoint.y, impactPoint.z);
    return hit;
  }

  #updateBeamStream(color: number, start: Vector3, end: Vector3): void {
    if (this.#beamStream === null || this.#beamStreamColor !== color) {
      this.releaseBeamStream();
      this.#beamStream = createBeamStreamVisual(this.#scene, color);
      this.#beamStreamColor = color;
    }

    updateBeamStreamVisual(this.#beamStream, start, end);
  }

  #spawnTracer(start: Vector3, end: Vector3, color: number, durationMs: number): void {
    if (this.#segmentLines === null) {
      return;
    }

    this.#segmentLines.spawnSegment(start, end, color, durationMs);
  }

  #spawnImpact(
    weapon: WeaponDefinition,
    position: Vector3,
    kind: 'hit' | 'ricochet',
    impact: ImpactProfile,
    nowMs = performance.now()
  ): void {
    if (this.#sphereInstancing === null) {
      return;
    }

    if (this.#impactBursts.length >= MAX_HITSCAN_IMPACT_BURSTS) {
      const oldest = this.#impactBursts[0];
      disposeImpactBurst(this.#sphereInstancing, oldest);
      const lastIndex = this.#impactBursts.length - 1;
      this.#impactBursts[0] = this.#impactBursts[lastIndex];
      this.#impactBursts.length = lastIndex;
    }

    const burst = spawnProjectileImpactBurst(
      this.#sphereInstancing,
      weapon,
      impact,
      position,
      kind,
      undefined,
      nowMs
    );
    if (burst !== null) {
      this.#impactBursts.push(burst);
    }
  }
}

export function resolveHitscanRange(fire: FireProfile): number {
  if (fire.hitscanRangeM !== undefined && fire.hitscanRangeM > 0) {
    return fire.hitscanRangeM;
  }

  if (fire.speed > 0) {
    return fire.speed;
  }

  return WEAPON_CONFIG.range;
}
