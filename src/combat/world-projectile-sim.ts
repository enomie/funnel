// Path: /Users/johann/MyBrew/funnel-real/src/combat/world-projectile-sim.ts

import RAPIER from '@dimforge/rapier3d-simd-compat';
import type { Collider, RigidBody, World } from '@dimforge/rapier3d-simd-compat';
import {
  Object3D,
  Scene,
  Vector3
} from 'three/webgpu';
import { ACTOR_RAY_QUERY_GROUPS } from '../physics/collision-groups';
import {
  disposeImpactBurst,
  spawnProjectileImpactBurst,
  updateImpactBurst,
  type ImpactBurst,
  type ImpactBurstKind
} from './projectile-impact-visual';
import {
  createProjectileVisual,
  createRipperCoreVisual,
  disposeSceneProjectileVisual,
  isBoltProjectileKind,
  resetProjectileTransform
} from './projectile-visuals';
import type { CombatImpactSink } from './apply-impact';
import type { ApplyImpactDeps } from './apply-impact';
import {
  spawnExpandingLethalBlast,
  tickExpandingLethalBlastEffect,
  type ExpandingLethalBlast
} from './expanding-lethal-blast';
import { CombatPointLightPool } from '../render/combat-point-light-pool';
import {
  beginRedeemerImpactFlash,
  beginRocketImpactFlash,
  releaseRedeemerFlightLight,
  syncRedeemerFlightLight,
  tickExplosiveImpactFlashes,
  tryAcquireRedeemerFlightLight,
  type ExplosivePointLightFlash
} from './redeemer-point-light';
import {
  findFirstRipperActorAlongStep,
  prepareRipperProjectileVisual,
  resolveRipperImpactAt,
  ripperHitRadius,
  ripperPowerFraction,
  syncRipperProjectileFade,
  RIPPER_RICOCHET_MAX
} from './ripper-disk';
import { IMPACT_GAIN_NORMAL, IMPACT_GAIN_EXPLOSIVE, IMPACT_GAIN_REDEEMER } from '../game-audio/audio-config';
import type { WeaponAudio } from '../game-audio/audio-weapon/audio-weapon';
import { PHYSICS_CONFIG, DEBUG_CONFIG, FUNNEL_DIMENSIONS } from '../config/game-config';
import type {
  InstancedProjectileVisual,
  SphereInstancingService
} from '../render/sphere-instancing';
import type { SegmentLineInstancingService } from '../render/segment-line-instancing';
import type { BoltInstancingService, InstancedBoltVisual } from '../render/bolt-instancing';
import type {
  RocketSmokeTrailInstancingService
} from '../render/rocket-smoke-trail-instancing';
import { ROCKET_SMOKE_SPAWN_INTERVAL_MS } from '../render/rocket-smoke-trail-instancing';
import {
  findFirstShockOrbAlongRay,
  projectileIsShockOrb,
  shockOrbHitRadius,
  type ShockOrbRayHit,
  type ShockOrbTarget
} from './shock-combo';
import type { FactionTeam } from './teams';
import {
  DEFAULT_IMPACT_EXPAND_MS,
  type FireProfile,
  type ImpactProfile,
  type WeaponDefinition
} from './weapon-definitions';
import {
  projectileIsGuidedRedeemer,
  steerTowardDirection,
  directionFromYawPitch,
  resolveGuidedRedeemerCamera,
  type GuidedRedeemerCameraState
} from './redeemer-guided';
import {
  registerWorldEffectsSource,
  unregisterWorldEffectsSource,
  type WorldEffectsSource
} from './world-effects-registry';

const GUIDED_TURN_RATE_RAD_S = 2.35;

const PROJECTILE_GRAVITY_Y = PHYSICS_CONFIG.gravity.y;
const STICK_IMPACT_GAIN = IMPACT_GAIN_NORMAL * 0.55;
const BIO_STICK_SPLAT_RADIUS = 0.12;
const DIRECT_HIT_SPLAT_RADIUS = 0.14;
const GRENADE_SPLIT_IMPACT_GAIN = IMPACT_GAIN_NORMAL * 0.72;
const REDEEMER_GUIDED_IMPACT_GAIN = IMPACT_GAIN_REDEEMER;

const RIPPER_RICOCHET_LIMIT = RIPPER_RICOCHET_MAX;
const _worldUp = new Vector3(0, 1, 0);
const BOUNCE_SURFACE_NUDGE = 0.035;

const PROJECTILE_SPAWN_ORIGIN_NUDGE_M = 0.08;
const MIN_STEP_DISTANCE = 0.001;
const MAX_COLLISION_STEPS_PER_FRAME = RIPPER_RICOCHET_LIMIT + 1;
const TRAIL_SPAWN_INTERVAL_MS = 26;
const TRAIL_REMOVE_AFTER_MS = 90;
const ROCKET_SPIN_RAD_S = 4.8;
const MAX_IMPACT_BURSTS = 48;
const MAX_EXPANDING_LETHAL_BLASTS = 6;
const MAX_WORLD_PROJECTILES = 256;
const _shockOrbScratch: ShockOrbTarget[] = [];

function writeShockOrbTarget(
  index: number,
  projectileId: number,
  position: Vector3,
  hitRadius: number
): void {
  if (index < _shockOrbScratch.length) {
    const entry = _shockOrbScratch[index];
    entry.projectileId = projectileId;
    entry.position = position;
    entry.hitRadius = hitRadius;
    return;
  }

  _shockOrbScratch.push({ projectileId, position, hitRadius });
}
const DEFAULT_PROJECTILE_MAX_FLIGHT_MS = 12_000;
const PROJECTILE_OOB_MARGIN_M = 12;

const _previousPosition = new Vector3();
const _steerTarget = new Vector3();
const _projectileHitPoint = new Vector3();
const _projectileHitNormal = new Vector3();
const _reflectNormal = new Vector3();
const _shrapnelSpawnPoint = new Vector3();
const _shrapnelBase = new Vector3();
const _shrapnelRight = new Vector3();
const _shrapnelTangentUp = new Vector3();
const _shrapnelDirection = new Vector3();
const _spreadRight = new Vector3();
const _spreadUp = new Vector3();
const _spreadOffset = new Vector3();

const MAX_PROJECTILE_SPREAD = 12;
const _spreadDirections: Vector3[] = [];
for (let spreadIndex = 0; spreadIndex < MAX_PROJECTILE_SPREAD; spreadIndex += 1) {
  _spreadDirections.push(new Vector3());
}

const _projectileVectorPool: Vector3[] = [];

function acquireProjectileVector(source?: Vector3): Vector3 {
  const vector = _projectileVectorPool.pop() ?? new Vector3();
  if (source !== undefined) {
    vector.copy(source);
  }
  return vector;
}

function releaseProjectileVector(vector: Vector3): void {
  _projectileVectorPool.push(vector);
}

function releaseProjectileVectors(projectile: WorldProjectile): void {
  releaseProjectileVector(projectile.position);
  releaseProjectileVector(projectile.direction);
  releaseProjectileVector(projectile.velocity);
  if (projectile.spawnOrigin !== null) {
    releaseProjectileVector(projectile.spawnOrigin);
  }
}

let _projectileCastRay: RAPIER.Ray | null = null;

function projectileCastRay(origin: Vector3, direction: Vector3): RAPIER.Ray {
  if (_projectileCastRay === null) {
    _projectileCastRay = new RAPIER.Ray(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: direction.x, y: direction.y, z: direction.z }
    );
    return _projectileCastRay;
  }

  _projectileCastRay.origin.x = origin.x;
  _projectileCastRay.origin.y = origin.y;
  _projectileCastRay.origin.z = origin.z;
  _projectileCastRay.dir.x = direction.x;
  _projectileCastRay.dir.y = direction.y;
  _projectileCastRay.dir.z = direction.z;
  return _projectileCastRay;
}

function copyRapierVector3(out: Vector3, vector: { x: number; y: number; z: number }): Vector3 {
  return out.set(vector.x, vector.y, vector.z);
}

export interface ProjectileSpawnLimits {
  maxRangeM: number;
  maxLifetimeMs: number;
}

export interface WorldProjectile {
  readonly id: number;
  readonly ownerId: string;
  weapon: WeaponDefinition;
  fire: FireProfile;
  impact: ImpactProfile;
  tags: readonly string[];
  object: Object3D | null;
  instanced: InstancedProjectileVisual | null;
  boltInstanced: InstancedBoltVisual | null;
  position: Vector3;
  direction: Vector3;
  velocity: Vector3;
  ballistic: boolean;
  ricochetsRemaining: number;
  lastTrailAt: number;
  lastSmokeAt: number;
  rollAngle: number;
  flySlot: number | null;
  stuckDetonateAtMs: number;
  visualScale: number;
  spawnOrigin: Vector3 | null;
  maxRangeM: number;
  expiresAtMs: number;
  spawnedAtMs: number;
  
  lightSlot: number;
}

interface ProjectileHit {
  collider: Collider;
  point: Vector3;
  normal: Vector3;
  distance: number;
}

export interface ProjectileSimBridge {
  readonly ownerId: string;
  readonly ignoredBody: RigidBody;
  readonly maxActive: number;
  readonly sourceFaction: () => FactionTeam;
  readonly impactSink: CombatImpactSink;
  resolveShockCombo?(hit: ShockOrbRayHit): void;
}

interface ActiveImpactEffect {
  burst: ImpactBurst | null;
  expandingLethal: ExpandingLethalBlast | null;
}

export class WorldProjectileSim implements WorldEffectsSource {
  readonly #scene: Scene;
  readonly #world: World;
  readonly #impactDeps: ApplyImpactDeps;
  readonly #audio: WeaponAudio;
  readonly #sphereInstancing: SphereInstancingService | null;
  readonly #boltInstancing: BoltInstancingService | null;
  readonly #segmentLines: SegmentLineInstancingService | null;
  readonly #rocketSmoke: RocketSmokeTrailInstancingService | null;
  readonly #bridges = new Map<string, ProjectileSimBridge>();
  readonly #projectiles: WorldProjectile[] = [];
  readonly #projectileById = new Map<number, WorldProjectile>();
  readonly #pointLightPool: CombatPointLightPool;
  readonly #redeemerFlashes: ExplosivePointLightFlash[] = [];
  readonly #impactEffects: ActiveImpactEffect[] = [];
  readonly #ownerAim = new Map<string, { yaw: number; pitch: number }>();
  #nextProjectileId = 1;
  #projectileTickNowMs = 0;
  #shedNonCriticalThisFrame = false;
  #flybySyncPhase = 0;

  constructor(
    scene: Scene,
    world: World,
    impactDeps: ApplyImpactDeps,
    weaponAudio: WeaponAudio,
    sphereInstancing: SphereInstancingService | null = null,
    segmentLines: SegmentLineInstancingService | null = null,
    boltInstancing: BoltInstancingService | null = null,
    rocketSmoke: RocketSmokeTrailInstancingService | null = null
  ) {
    this.#scene = scene;
    this.#world = world;
    this.#impactDeps = impactDeps;
    this.#audio = weaponAudio;
    this.#sphereInstancing = sphereInstancing;
    this.#boltInstancing = boltInstancing;
    this.#segmentLines = segmentLines;
    this.#rocketSmoke = rocketSmoke;
    this.#pointLightPool = new CombatPointLightPool(scene);
    registerWorldEffectsSource(this);
  }

  registerBridge(bridge: ProjectileSimBridge): void {
    this.#bridges.set(bridge.ownerId, bridge);
  }

  unregisterBridge(ownerId: string): void {
    this.#bridges.delete(ownerId);
    this.#ownerAim.delete(ownerId);
  }

  releaseOwner(ownerId: string): void {
    for (let index = this.#projectiles.length - 1; index >= 0; index -= 1) {
      if (this.#projectiles[index].ownerId === ownerId) {
        this.#removeProjectileAt(index);
      }
    }
    this.#ownerAim.delete(ownerId);
  }

  releaseAll(): void {
    while (this.#projectiles.length > 0) {
      this.#removeProjectileAt(this.#projectiles.length - 1);
    }
    for (const effect of this.#impactEffects) {
      if (this.#sphereInstancing !== null && effect.burst !== null) {
        disposeImpactBurst(this.#sphereInstancing, effect.burst);
      }
      this.#disposeExpandingLethalAudio(effect.expandingLethal);
    }
    this.#impactEffects.length = 0;
    this.#redeemerFlashes.length = 0;
    this.#pointLightPool.releaseAll();
    this.#rocketSmoke?.clearAll();
    this.#bridges.clear();
    this.#ownerAim.clear();
    unregisterWorldEffectsSource(this);
  }

  setOwnerAim(ownerId: string, aim: { yaw: number; pitch: number } | undefined): void {
    if (aim === undefined) {
      this.#ownerAim.delete(ownerId);
      return;
    }
    this.#ownerAim.set(ownerId, aim);
  }

  listShockOrbs(ownerId?: string): readonly ShockOrbTarget[] {
    let count = 0;
    for (const projectile of this.#projectiles) {
      if (ownerId !== undefined && projectile.ownerId !== ownerId) {
        continue;
      }
      if (!projectileIsShockOrb(projectile.tags)) {
        continue;
      }

      writeShockOrbTarget(
        count,
        projectile.id,
        projectile.position,
        shockOrbHitRadius(projectile.visualScale)
      );
      count += 1;
    }
    _shockOrbScratch.length = count;
    return _shockOrbScratch;
  }

  hasProjectile(id: number): boolean {
    return this.#projectileById.has(id);
  }

  getSteerState(id: number, out: GuidedRedeemerCameraState): GuidedRedeemerCameraState | null {
    const projectile = this.#projectileById.get(id);
    if (projectile === undefined) {
      return null;
    }
    return resolveGuidedRedeemerCamera(projectile.position, projectile.direction, out);
  }

  removeById(id: number): WorldProjectile | null {
    const projectile = this.#projectileById.get(id);
    if (projectile === undefined) {
      return null;
    }
    const index = this.#projectiles.indexOf(projectile);
    if (index < 0) {
      return null;
    }
    this.#removeProjectileAt(index);
    return projectile;
  }

  spawnImpactBurst(
    weapon: WeaponDefinition,
    impact: ImpactProfile,
    position: Vector3,
    kind: ImpactBurstKind,
    impactRadiusOverride?: number,
    nowMs?: number
  ): void {
    this.#spawnImpact(weapon, impact, position, kind, impactRadiusOverride, nowMs);
  }

  spawnOwnerLethalDetonation(
    ownerId: string,
    weapon: WeaponDefinition,
    impact: ImpactProfile,
    position: Vector3,
    nowMs: number,
    impactGain: number,
    hitCollider?: Collider
  ): void {
    this.#spawnLethalDetonationAt(
      ownerId,
      weapon,
      impact,
      position,
      nowMs,
      impactGain,
      hitCollider
    );
  }

  detonateById(id: number, impactGain = REDEEMER_GUIDED_IMPACT_GAIN): boolean {
    const projectile = this.#projectileById.get(id);
    if (projectile === undefined) {
      return false;
    }
    this.#detonateProjectile(projectile, projectile.position, undefined, impactGain);
    const index = this.#projectiles.indexOf(projectile);
    if (index >= 0) {
      this.#removeProjectileAt(index);
    }
    return true;
  }

  spawn(
    ownerId: string,
    weapon: WeaponDefinition,
    fire: FireProfile,
    impact: ImpactProfile,
    direction: Vector3,
    muzzlePosition: Vector3,
    nowMs: number,
    limits?: ProjectileSpawnLimits
  ): number {
    const bridge = this.#bridges.get(ownerId);
    if (bridge === undefined) {
      return -1;
    }

    while (this.#projectiles.length >= MAX_WORLD_PROJECTILES) {
      this.#removeProjectileAt(0);
    }

    let ownerCount = 0;
    for (const projectile of this.#projectiles) {
      if (projectile.ownerId === ownerId) {
        ownerCount += 1;
      }
    }
    while (ownerCount >= bridge.maxActive) {
      const evictIndex = this.#projectiles.findIndex((projectile) => projectile.ownerId === ownerId);
      if (evictIndex < 0) {
        break;
      }
      this.#removeProjectileAt(evictIndex);
      ownerCount -= 1;
    }

    const position = acquireProjectileVector(muzzlePosition);
    const normalizedDirection = acquireProjectileVector(direction).normalize();
    position.addScaledVector(normalizedDirection, PROJECTILE_SPAWN_ORIGIN_NUDGE_M);
    const velocity = acquireProjectileVector(normalizedDirection).multiplyScalar(fire.speed);
    const visualScale = fire.projectileScale ?? 1;
    const projectileColor = fire.projectileColor ?? weapon.color;
    const tags = fire.projectileTags ?? [];
    const isShockOrb = projectileIsShockOrb(tags);
    const useBolt =
      isBoltProjectileKind(weapon.visualKind) && !isShockOrb;
    const useSphere =
      !useBolt &&
      !isShockOrb &&
      weapon.visualKind !== 'ripper' &&
      this.#sphereInstancing !== null;
    let object: Object3D | null = null;
    let instanced: InstancedProjectileVisual | null = null;
    let boltInstanced: InstancedBoltVisual | null = null;

    if (weapon.visualKind === 'ripper') {
      object = createRipperCoreVisual(projectileColor);
      prepareRipperProjectileVisual(object, projectileColor);
      object.position.copy(position);
      this.#applyProjectileVisualScale(object, visualScale);
      this.#scene.add(object);
    } else if (useBolt && this.#boltInstancing !== null) {
      boltInstanced = this.#boltInstancing.acquireBolt(projectileColor, weapon.visualKind);
      if (boltInstanced === null) {
        const evictIndex = this.#projectiles.findIndex((p) => p.ownerId === ownerId);
        if (evictIndex >= 0) {
          this.#removeProjectileAt(evictIndex);
        }
        boltInstanced = this.#boltInstancing.acquireBolt(projectileColor, weapon.visualKind);
      }
      if (boltInstanced !== null) {
        this.#boltInstancing.syncBolt(
          boltInstanced,
          position.x,
          position.y,
          position.z,
          normalizedDirection.x,
          normalizedDirection.y,
          normalizedDirection.z,
          visualScale
        );
      }
    } else if (isShockOrb) {
      object = createProjectileVisual(weapon.visualKind, projectileColor);
      object.position.copy(position);
      this.#applyProjectileVisualScale(object, visualScale);
      this.#scene.add(object);
    } else if (useSphere) {
      const instancing = this.#sphereInstancing;
      instanced = instancing.acquireProjectile(weapon.visualKind, projectileColor);
      if (instanced === null) {
        const evictIndex = this.#projectiles.findIndex((p) => p.ownerId === ownerId);
        if (evictIndex >= 0) {
          this.#removeProjectileAt(evictIndex);
        }
        instanced = instancing.acquireProjectile(weapon.visualKind, projectileColor);
      }
      if (instanced !== null) {
        instancing.syncProjectile(
          instanced,
          position.x,
          position.y,
          position.z,
          visualScale
        );
      }
    }

    if (instanced === null && boltInstanced === null && object === null) {
      releaseProjectileVector(position);
      releaseProjectileVector(normalizedDirection);
      releaseProjectileVector(velocity);
      return -1;
    }

    const flySlot = this.#audio.attachProjectileFly(
      weapon,
      position,
      normalizedDirection,
      fire.speed,
      impact.impactRadius
    );
    const id = this.#nextProjectileId;
    this.#nextProjectileId += 1;

    let lightSlot = -1;
    if (weapon.visualKind === 'redeemer') {
      lightSlot = tryAcquireRedeemerFlightLight(this.#pointLightPool);
    }

    const projectile: WorldProjectile = {
      id,
      ownerId,
      weapon,
      fire,
      impact,
      tags,
      object,
      instanced,
      boltInstanced,
      position,
      direction: normalizedDirection,
      velocity,
      ballistic: fire.trajectory === 'ballistic',
      ricochetsRemaining: impact.ricochetMax,
      lastTrailAt: 0,
      lastSmokeAt: 0,
      rollAngle: 0,
      flySlot,
      stuckDetonateAtMs: 0,
      visualScale,
      spawnOrigin: limits !== undefined ? acquireProjectileVector(position) : null,
      maxRangeM: limits?.maxRangeM ?? 0,
      expiresAtMs: limits !== undefined ? nowMs + limits.maxLifetimeMs : 0,
      spawnedAtMs: nowMs,
      lightSlot
    };

    if (lightSlot >= 0) {
      syncRedeemerFlightLight(this.#pointLightPool, lightSlot, position.x, position.y, position.z);
    }

    this.#projectiles.push(projectile);
    this.#projectileById.set(id, projectile);
    this.#syncProjectileVisual(projectile);
    return id;
  }

  needsWorldTick(_nowMs: number): boolean {
    return (
      this.#projectiles.length > 0 ||
      this.#impactEffects.length > 0 ||
      this.#redeemerFlashes.length > 0 ||
      this.#pointLightPool.hasActive() ||
      (this.#rocketSmoke !== null && this.#rocketSmoke.hasActive())
    );
  }

  tickWorld(nowMs: number, deltaSeconds: number, shedNonCritical = false): void {
    this.#updateProjectiles(deltaSeconds, nowMs, shedNonCritical);
    this.#updateImpactEffects(nowMs);
    tickExplosiveImpactFlashes(this.#pointLightPool, this.#redeemerFlashes, nowMs);
    if (this.#rocketSmoke !== null && this.#rocketSmoke.hasActive()) {
      this.#rocketSmoke.tick(nowMs);
    }
  }

  #bridgeFor(projectile: WorldProjectile): ProjectileSimBridge | null {
    return this.#bridges.get(projectile.ownerId) ?? null;
  }

  #updateProjectiles(deltaSeconds: number, nowMs: number, shedNonCritical: boolean): void {
    this.#projectileTickNowMs = nowMs;
    this.#shedNonCriticalThisFrame = shedNonCritical;
    const flybySyncStride =
      shedNonCritical ? 0 : this.#projectiles.length > 14 ? 2 : 1;
    let index = this.#projectiles.length - 1;
    while (index >= 0) {
      if (index >= this.#projectiles.length) {
        index = this.#projectiles.length - 1;
        if (index < 0) {
          break;
        }
      }

      const projectile = this.#projectiles[index];
      let removedCurrent = false;

      if (projectile.stuckDetonateAtMs > 0) {
        this.#syncProjectileVisual(projectile);
        this.#syncRedeemerFlightLightFor(projectile);
        if (nowMs >= projectile.stuckDetonateAtMs) {
          this.#detonateProjectile(projectile, projectile.position);
          this.#removeProjectile(projectile);
          removedCurrent = true;
        }
      } else {
        this.#steerGuidedProjectile(projectile, deltaSeconds);

        if (projectile.weapon.visualKind === 'rocket') {
          projectile.rollAngle += ROCKET_SPIN_RAD_S * deltaSeconds;
        }

        const previousPosition = _previousPosition.copy(projectile.position);
        this.#integrateProjectileMotion(projectile, deltaSeconds);
        let remainingDistance = projectile.velocity.length() * deltaSeconds;
        let shouldRemove = false;
        let collisionSteps = 0;

        while (remainingDistance > MIN_STEP_DISTANCE) {
          if (collisionSteps >= MAX_COLLISION_STEPS_PER_FRAME) {
            projectile.position.addScaledVector(projectile.direction, remainingDistance);
            this.#spawnTrail(projectile, previousPosition, projectile.position);
            break;
          }

          const comboHit = this.#findShockComboHit(projectile, remainingDistance);
          const hit = this.#castProjectileStep(projectile, remainingDistance);

          if (
            comboHit !== null &&
            (hit === null || comboHit.distance <= hit.distance)
          ) {
            this.#spawnTrail(projectile, previousPosition, comboHit.point, true);
            this.#bridgeFor(projectile)?.resolveShockCombo?.(comboHit);
            shouldRemove = true;
            break;
          }

          if (hit === null) {
            projectile.position.addScaledVector(projectile.direction, remainingDistance);
            this.#spawnTrail(projectile, previousPosition, projectile.position);
            break;
          }

          this.#spawnTrail(projectile, previousPosition, hit.point, true);
          const stepDistance = Math.max(hit.distance, MIN_STEP_DISTANCE);
          remainingDistance -= stepDistance;

          if (this.#tryRipperActorHit(projectile, hit)) {
            shouldRemove = true;
            break;
          }

          if (this.#tryRicochet(projectile, hit)) {
            previousPosition.copy(projectile.position);
            collisionSteps += 1;
            continue;
          }

          if (this.#tryBioDirectActorHit(projectile, hit)) {
            shouldRemove = true;
            break;
          }

          if (this.#tryStickProjectile(projectile, hit)) {
            shouldRemove = false;
            break;
          }

          this.#handleProjectileHit(projectile, hit);
          shouldRemove = true;
          break;
        }

        if (shouldRemove) {
          this.#removeProjectile(projectile);
          removedCurrent = true;
        } else if (this.#shouldExpireProjectile(projectile, nowMs)) {
          this.#detonateProjectile(projectile, projectile.position);
          this.#removeProjectile(projectile);
          removedCurrent = true;
        } else {
          if (projectile.flySlot !== null) {
            const shouldSyncFlyby =
              flybySyncStride > 0 &&
              (flybySyncStride === 1 ||
                ((projectile.id + this.#flybySyncPhase) & 1) === 0);
            if (
              shouldSyncFlyby &&
              !this.#audio.syncProjectileFly(
                projectile.flySlot,
                projectile.position,
                projectile.direction,
                projectile.velocity.length()
              )
            ) {
              projectile.flySlot = null;
            }
          }

          if (
            !shedNonCritical &&
            projectile.flySlot === null &&
            this.#audio.hasFreeProjectileFlySlot()
          ) {
            projectile.flySlot = this.#audio.attachProjectileFly(
              projectile.weapon,
              projectile.position,
              projectile.direction,
              projectile.velocity.length(),
              projectile.impact.impactRadius
            );
          }

          this.#syncProjectileVisual(projectile);
          this.#syncRedeemerFlightLightFor(projectile);
        }
      }

      if (removedCurrent) {
        if (index >= this.#projectiles.length) {
          index = this.#projectiles.length - 1;
        }
        continue;
      }

      index -= 1;
    }
    this.#flybySyncPhase = (this.#flybySyncPhase + 1) & 1;
  }

  #syncRedeemerFlightLightFor(projectile: WorldProjectile): void {
    if (projectile.lightSlot < 0) {
      return;
    }

    syncRedeemerFlightLight(
      this.#pointLightPool,
      projectile.lightSlot,
      projectile.position.x,
      projectile.position.y,
      projectile.position.z
    );
  }

  #steerGuidedProjectile(projectile: WorldProjectile, deltaSeconds: number): void {
    if (!projectileIsGuidedRedeemer(projectile.tags)) {
      return;
    }

    const aim = this.#ownerAim.get(projectile.ownerId);
    if (aim === undefined) {
      return;
    }

    directionFromYawPitch(aim.yaw, aim.pitch, _steerTarget);
    steerTowardDirection(
      projectile.direction,
      _steerTarget,
      GUIDED_TURN_RATE_RAD_S * deltaSeconds,
      projectile.direction
    );
    projectile.velocity.copy(projectile.direction).multiplyScalar(projectile.fire.speed);
  }

  #syncProjectileVisual(projectile: WorldProjectile): void {
    if (projectile.boltInstanced !== null && this.#boltInstancing !== null) {
      this.#boltInstancing.syncBolt(
        projectile.boltInstanced,
        projectile.position.x,
        projectile.position.y,
        projectile.position.z,
        projectile.direction.x,
        projectile.direction.y,
        projectile.direction.z,
        projectile.visualScale,
        projectile.rollAngle
      );
      return;
    }

    if (projectile.instanced !== null && this.#sphereInstancing !== null) {
      this.#sphereInstancing.syncProjectile(
        projectile.instanced,
        projectile.position.x,
        projectile.position.y,
        projectile.position.z,
        projectile.visualScale
      );
      return;
    }

    if (projectile.object !== null) {
      projectile.object.position.copy(projectile.position);
      this.#applyProjectileVisualScale(projectile.object, projectile.visualScale);
    }
  }

  #findShockComboHit(
    projectile: WorldProjectile,
    maxDistance: number
  ): ShockOrbRayHit | null {
    if (projectileIsShockOrb(projectile.tags)) {
      return null;
    }

    if (projectile.weapon.comboImpact === undefined || maxDistance <= 0) {
      return null;
    }

    const orbs = this.listShockOrbs(projectile.ownerId);
    if (orbs.length === 0) {
      return null;
    }

    return findFirstShockOrbAlongRay(
      projectile.position,
      projectile.direction,
      maxDistance,
      orbs,
      projectile.id
    );
  }

  #castProjectileStep(projectile: WorldProjectile, distance: number): ProjectileHit | null {
    if (distance <= 0) {
      return null;
    }

    const bridge = this.#bridgeFor(projectile);
    if (bridge === null) {
      return null;
    }

    const ray = projectileCastRay(projectile.position, projectile.direction);
    const rapierHit = this.#world.castRayAndGetNormal(
      ray,
      distance,
      true,
      undefined,
      ACTOR_RAY_QUERY_GROUPS,
      undefined,
      bridge.ignoredBody
    );

    let wallHit: ProjectileHit | null = null;
    if (rapierHit !== null) {
      const impactPoint = ray.pointAt(rapierHit.timeOfImpact);
      copyRapierVector3(_projectileHitPoint, impactPoint);
      copyRapierVector3(_projectileHitNormal, rapierHit.normal).normalize();
      wallHit = {
        collider: rapierHit.collider,
        point: _projectileHitPoint,
        normal: _projectileHitNormal,
        distance: rapierHit.timeOfImpact
      };
    }

    if (projectile.weapon.visualKind !== 'ripper' || projectile.impact.ricochetMax <= 0) {
      return wallHit;
    }

    const actorHit = findFirstRipperActorAlongStep(
      this.#impactDeps.registry,
      projectile.position,
      projectile.direction,
      distance,
      ripperHitRadius(projectile.visualScale),
      bridge.ownerId
    );
    if (actorHit === null) {
      return wallHit;
    }

    if (wallHit !== null && wallHit.distance <= actorHit.distance) {
      return wallHit;
    }

    _projectileHitPoint.copy(actorHit.point);
    _projectileHitNormal.copy(projectile.direction).negate().normalize();
    return {
      collider: actorHit.collider,
      point: _projectileHitPoint,
      normal: _projectileHitNormal,
      distance: actorHit.distance
    };
  }

  #integrateProjectileMotion(projectile: WorldProjectile, deltaSeconds: number): void {
    if (projectile.ballistic) {
      projectile.velocity.y += PROJECTILE_GRAVITY_Y * deltaSeconds;
    } else {
      projectile.velocity.copy(projectile.direction).multiplyScalar(projectile.fire.speed);
    }

    if (projectile.velocity.lengthSq() > MIN_STEP_DISTANCE * MIN_STEP_DISTANCE) {
      projectile.direction.copy(projectile.velocity).normalize();
    }
  }

  #tryBioDirectActorHit(projectile: WorldProjectile, hit: ProjectileHit): boolean {
    const stickDelayMs = projectile.impact.stickDelayMs;
    if (stickDelayMs === undefined || stickDelayMs <= 0) {
      return false;
    }

    const actor = this.#impactDeps.registry.resolveCollider(hit.collider);
    if (actor === null) {
      return false;
    }

    this.#applyDirectOnlyHit(projectile, hit.point, hit.collider);
    return true;
  }

  #tryRipperActorHit(projectile: WorldProjectile, hit: ProjectileHit): boolean {
    if (projectile.weapon.visualKind !== 'ripper' || projectile.impact.ricochetMax <= 0) {
      return false;
    }

    const actor = this.#impactDeps.registry.resolveCollider(hit.collider);
    if (actor === null) {
      return false;
    }

    const bridge = this.#bridgeFor(projectile);
    if (bridge === null) {
      return false;
    }

    const gameplayImpact = resolveRipperImpactAt(
      projectile.weapon.visualKind,
      projectile.impact,
      projectile.ricochetsRemaining
    );
    this.#audio.playImpact(projectile.weapon, hit.point, IMPACT_GAIN_NORMAL, gameplayImpact);
    this.#spawnRipperImpactBurst(projectile, hit.point);
    bridge.impactSink.apply({
      impact: gameplayImpact,
      point: hit.point,
      hitCollider: hit.collider,
      sourceWeaponVisualKind: projectile.weapon.visualKind,
      nowMs: this.#projectileTickNowMs
    });
    return true;
  }

  #applyDirectOnlyHit(
    projectile: WorldProjectile,
    point: Vector3,
    hitCollider: Collider
  ): void {
    const bridge = this.#bridgeFor(projectile);
    if (bridge === null) {
      return;
    }

    const directImpact: ImpactProfile = {
      ...projectile.impact,
      impactRadius: 0
    };
    this.#audio.playImpact(projectile.weapon, point, IMPACT_GAIN_NORMAL, directImpact);
    this.#spawnImpact(
      projectile.weapon,
      directImpact,
      point,
      'ricochet',
      DIRECT_HIT_SPLAT_RADIUS
    );
    bridge.impactSink.apply({
      impact: directImpact,
      point,
      hitCollider,
      sourceWeaponVisualKind: projectile.weapon.visualKind,
      nowMs: this.#projectileTickNowMs
    });
  }

  #tryStickProjectile(projectile: WorldProjectile, hit: ProjectileHit): boolean {
    const delayMs = projectile.impact.stickDelayMs;
    if (delayMs === undefined || delayMs <= 0) {
      return false;
    }

    const bridge = this.#bridgeFor(projectile);
    if (bridge === null) {
      return false;
    }

    projectile.velocity.set(0, 0, 0);
    projectile.position
      .copy(hit.point)
      .addScaledVector(hit.normal, BOUNCE_SURFACE_NUDGE * 0.35);
    projectile.stuckDetonateAtMs = this.#projectileTickNowMs + delayMs;
    projectile.ricochetsRemaining = 0;

    if (projectile.flySlot !== null) {
      this.#audio.detachProjectileFly(projectile.flySlot);
      projectile.flySlot = null;
    }

    this.#audio.playImpact(
      projectile.weapon,
      projectile.position,
      STICK_IMPACT_GAIN,
      { ...projectile.impact, impactRadius: BIO_STICK_SPLAT_RADIUS }
    );
    this.#spawnImpact(
      projectile.weapon,
      projectile.impact,
      projectile.position,
      'ricochet',
      BIO_STICK_SPLAT_RADIUS
    );
    return true;
  }

  #detonateProjectile(
    projectile: WorldProjectile,
    position: Vector3,
    hitCollider?: Collider,
    impactGain = projectile.impact.expandingLethal
      ? IMPACT_GAIN_REDEEMER
      : projectile.impact.explodeOnContact
        ? IMPACT_GAIN_EXPLOSIVE
        : IMPACT_GAIN_NORMAL
  ): void {
    if (projectile.impact.expandingLethal === true) {
      this.#beginExpandingLethalDetonation(projectile, position, hitCollider, impactGain);
      return;
    }

    const bridge = this.#bridgeFor(projectile);
    if (bridge === null) {
      return;
    }

    const impact = resolveRipperImpactAt(
      projectile.weapon.visualKind,
      projectile.impact,
      projectile.ricochetsRemaining
    );
    this.#audio.playImpact(projectile.weapon, position, impactGain, impact);
    if (projectile.weapon.visualKind === 'ripper') {
      this.#spawnRipperImpactBurst(projectile, position);
    } else {
      this.#spawnImpact(projectile.weapon, impact, position, 'hit');
    }
    bridge.impactSink.apply({
      impact,
      point: position,
      hitCollider,
      sourceWeaponVisualKind: projectile.weapon.visualKind,
      nowMs: this.#projectileTickNowMs
    });
  }

  #tryRicochet(projectile: WorldProjectile, hit: ProjectileHit): boolean {
    if (projectile.ricochetsRemaining <= 0) {
      return false;
    }

    const bridge = this.#bridgeFor(projectile);
    if (bridge === null) {
      return false;
    }

    projectile.ricochetsRemaining -= 1;
    const speed = projectile.velocity.length();
    reflectDirectionInto(projectile.velocity, hit.normal, projectile.velocity);
    projectile.velocity.setLength(speed);
    projectile.direction.copy(projectile.velocity).normalize();
    projectile.position.copy(hit.point).addScaledVector(hit.normal, BOUNCE_SURFACE_NUDGE);
    if (projectile.weapon.visualKind === 'ripper') {
      const gameplayImpact = resolveRipperImpactAt(
        projectile.weapon.visualKind,
        projectile.impact,
        projectile.ricochetsRemaining
      );
      this.#audio.playImpact(projectile.weapon, hit.point, IMPACT_GAIN_NORMAL, gameplayImpact, {
        ricochet: true
      });
      this.#spawnRipperImpactBurst(projectile, hit.point);
      if (projectile.object !== null) {
        const power = ripperPowerFraction(projectile.ricochetsRemaining, projectile.impact.ricochetMax);
        syncRipperProjectileFade(projectile.object, power);
      }
    }
    return true;
  }

  
  #spawnRipperImpactBurst(projectile: WorldProjectile, point: Vector3): void {
    this.#spawnImpact(projectile.weapon, projectile.impact, point, 'hit');
  }

  #handleProjectileHit(projectile: WorldProjectile, hit: ProjectileHit): void {
    _projectileHitPoint.copy(hit.point).addScaledVector(hit.normal, BOUNCE_SURFACE_NUDGE * 0.85);

    const shrapnelCount = projectile.impact.childShrapnelCount ?? 0;
    if (shrapnelCount > 0) {
      this.#splitIntoChildShrapnel(projectile, hit, shrapnelCount);
      return;
    }

    if (projectileIsGuidedRedeemer(projectile.tags)) {
      this.#detonateProjectile(
        projectile,
        _projectileHitPoint,
        hit.collider,
        REDEEMER_GUIDED_IMPACT_GAIN
      );
      return;
    }

    this.#detonateProjectile(projectile, _projectileHitPoint, hit.collider);
  }

  #shouldExpireProjectile(projectile: WorldProjectile, nowMs: number): boolean {
    if (projectile.expiresAtMs > 0 && nowMs >= projectile.expiresAtMs) {
      return true;
    }

    if (nowMs >= projectile.spawnedAtMs + DEFAULT_PROJECTILE_MAX_FLIGHT_MS) {
      return true;
    }

    if (isProjectileOutOfBounds(projectile.position)) {
      return true;
    }

    if (
      projectile.maxRangeM > 0 &&
      projectile.spawnOrigin !== null &&
      projectile.position.distanceTo(projectile.spawnOrigin) >= projectile.maxRangeM
    ) {
      return true;
    }

    return false;
  }

  #splitIntoChildShrapnel(
    projectile: WorldProjectile,
    hit: ProjectileHit,
    count: number
  ): void {
    const bridge = this.#bridgeFor(projectile);
    if (bridge === null) {
      return;
    }

    const impact = projectile.impact;
    _shrapnelSpawnPoint
      .copy(hit.point)
      .addScaledVector(hit.normal, BOUNCE_SURFACE_NUDGE * 0.6);

    this.#audio.playImpact(
      projectile.weapon,
      _shrapnelSpawnPoint,
      GRENADE_SPLIT_IMPACT_GAIN,
      impact
    );
    this.#spawnImpact(projectile.weapon, impact, _shrapnelSpawnPoint, 'hit');
    bridge.impactSink.apply({
      impact,
      point: _shrapnelSpawnPoint,
      hitCollider: hit.collider,
      sourceWeaponVisualKind: projectile.weapon.visualKind,
      nowMs: this.#projectileTickNowMs
    });

    const speed = impact.childShrapnelSpeed ?? 11;
    const spread = impact.childShrapnelSpreadRadians ?? 0.28;
    const arcUp = impact.childShrapnelArcUpBias ?? 0.09;
    const childFire: FireProfile = {
      fireIntervalMs: 0,
      projectileCount: 1,
      spreadRadians: 0,
      speed,
      damage: impact.childShrapnelDamage ?? 14,
      trajectory: 'ballistic',
      projectileScale: impact.childShrapnelScale ?? 0.65
    };
    const childImpact: ImpactProfile = {
      directDamage: impact.childShrapnelDamage ?? 14,
      impactRadius: impact.childShrapnelImpactRadius ?? 0.17,
      impactExpandMs: DEFAULT_IMPACT_EXPAND_MS,
      ricochetMax: 0,
      explodeOnContact: true,
      lethalSplash: true
    };
    const limits: ProjectileSpawnLimits = {
      maxRangeM: impact.childShrapnelMaxRangeM ?? 1.75,
      maxLifetimeMs: impact.childShrapnelMaxFlightMs ?? 400
    };

    eachLowShrapnelDirection(
      projectile.velocity,
      hit.normal,
      count,
      spread,
      arcUp,
      (direction) => {
        this.spawn(
          projectile.ownerId,
          projectile.weapon,
          childFire,
          childImpact,
          direction,
          _shrapnelSpawnPoint,
          this.#projectileTickNowMs,
          limits
        );
      }
    );
  }

  #spawnImpact(
    weapon: WeaponDefinition,
    impact: ImpactProfile,
    position: Vector3,
    kind: ImpactBurstKind,
    impactRadiusOverride?: number,
    nowMs?: number
  ): ImpactBurst | null {
    if (this.#sphereInstancing === null) {
      return null;
    }

    const burstNowMs = nowMs ?? this.#projectileTickNowMs;
    if (this.#impactEffects.length >= MAX_IMPACT_BURSTS) {
      this.#removeImpactEffectAt(0);
    }

    const burst = spawnProjectileImpactBurst(
      this.#sphereInstancing,
      weapon,
      impact,
      position,
      kind,
      burstNowMs,
      impactRadiusOverride
    );
    if (burst !== null) {
      this.#impactEffects.push({ burst, expandingLethal: null });
    }
    this.#maybeSpawnExplosiveImpactFlash(weapon, position, kind);
    return burst;
  }

  #updateImpactEffects(nowMs: number): void {
    if (this.#sphereInstancing === null) {
      return;
    }

    for (let index = this.#impactEffects.length - 1; index >= 0; index -= 1) {
      const effect = this.#impactEffects[index];
      let lethalComplete = true;
      if (effect.expandingLethal !== null) {
        lethalComplete = tickExpandingLethalBlastEffect(
          effect.expandingLethal,
          nowMs,
          this.#impactDeps
        );
      }

      const burstComplete =
        effect.burst === null ||
        updateImpactBurst(this.#sphereInstancing, effect.burst, nowMs);

      if (!burstComplete || !lethalComplete) {
        continue;
      }

      this.#removeImpactEffectAt(index);
    }
  }

  #beginExpandingLethalDetonation(
    projectile: WorldProjectile,
    position: Vector3,
    hitCollider?: Collider,
    impactGain = REDEEMER_GUIDED_IMPACT_GAIN
  ): void {
    if (projectile.weapon.visualKind === 'redeemer') {
      const flightLightSlot = projectile.lightSlot;
      projectile.lightSlot = -1;
      beginRedeemerImpactFlash(this.#pointLightPool, this.#redeemerFlashes, {
        flightLightSlot,
        x: position.x,
        y: position.y,
        z: position.z,
        spawnedAtMs: this.#projectileTickNowMs,
        expandMs: projectile.impact.impactExpandMs
      });
    }

    this.#spawnLethalDetonationAt(
      projectile.ownerId,
      projectile.weapon,
      projectile.impact,
      position,
      this.#projectileTickNowMs,
      impactGain,
      hitCollider
    );
  }

  #spawnLethalDetonationAt(
    ownerId: string,
    weapon: WeaponDefinition,
    impact: ImpactProfile,
    position: Vector3,
    nowMs: number,
    impactGain: number,
    hitCollider?: Collider
  ): void {
    const bridge = this.#bridges.get(ownerId);
    if (bridge === undefined) {
      return;
    }

    const savedTickNow = this.#projectileTickNowMs;
    this.#projectileTickNowMs = nowMs;
    this.#capExpandingLethalBlasts();

    const expandingLethal = spawnExpandingLethalBlast(
      position,
      impact.impactRadius,
      impact.impactExpandMs,
      bridge.sourceFaction(),
      bridge.ownerId,
      weapon.visualKind,
      impact.splashFriendlyFire === true,
      nowMs,
      hitCollider,
      this.#impactDeps
    );
    expandingLethal.audioSlot = this.#audio.playRedeemerBlastSpread(position, impactGain);

    const burst = this.#spawnImpact(weapon, impact, position, 'hit', undefined, nowMs);
    if (burst !== null) {
      const effectIndex = this.#impactEffects.findIndex((entry) => entry.burst === burst);
      if (effectIndex >= 0) {
        this.#impactEffects[effectIndex].expandingLethal = expandingLethal;
      }
      this.#projectileTickNowMs = savedTickNow;
      return;
    }

    this.#impactEffects.push({ burst: null, expandingLethal });
    this.#projectileTickNowMs = savedTickNow;
  }

  #maybeSpawnExplosiveImpactFlash(
    weapon: WeaponDefinition,
    position: Vector3,
    kind: ImpactBurstKind
  ): void {
    if (kind !== 'hit') {
      return;
    }

    const nowMs = this.#projectileTickNowMs;
    if (weapon.visualKind === 'rocket') {
      beginRocketImpactFlash(
        this.#pointLightPool,
        this.#redeemerFlashes,
        position.x,
        position.y,
        position.z,
        nowMs
      );
    }
  }

  #capExpandingLethalBlasts(): void {
    let expandingCount = 0;
    for (const effect of this.#impactEffects) {
      if (effect.expandingLethal !== null) {
        expandingCount += 1;
      }
    }

    while (expandingCount >= MAX_EXPANDING_LETHAL_BLASTS) {
      const evictIndex = this.#impactEffects.findIndex((effect) => effect.expandingLethal !== null);
      if (evictIndex < 0) {
        break;
      }
      this.#removeImpactEffectAt(evictIndex);
      expandingCount -= 1;
    }
  }

  #removeImpactEffectAt(index: number): void {
    const lastIndex = this.#impactEffects.length - 1;
    this.#disposeImpactEffect(this.#impactEffects[index]);
    if (index !== lastIndex) {
      this.#impactEffects[index] = this.#impactEffects[lastIndex];
    }
    this.#impactEffects.length = lastIndex;
  }

  #disposeExpandingLethalAudio(blast: ExpandingLethalBlast | null): void {
    if (blast === null || blast.audioSlot === null) {
      return;
    }

    this.#audio.stopRedeemerBlastSpread(blast.audioSlot);
    blast.audioSlot = null;
  }

  #disposeImpactEffect(effect: ActiveImpactEffect): void {
    this.#disposeExpandingLethalAudio(effect.expandingLethal);
    if (this.#sphereInstancing !== null && effect.burst !== null) {
      disposeImpactBurst(this.#sphereInstancing, effect.burst);
    }
  }

  #spawnTrail(projectile: WorldProjectile, start: Vector3, end: Vector3, force = false): void {
    if (this.#shedNonCriticalThisFrame && !force) {
      return;
    }

    if (projectile.weapon.visualKind === 'rocket') {
      this.#spawnRocketSmoke(projectile, force);
    }

    if (!DEBUG_CONFIG.showProjectileRays || this.#segmentLines === null) {
      return;
    }

    if (start.distanceToSquared(end) <= 0.0001) {
      return;
    }

    const nowMs = this.#projectileTickNowMs;
    if (!force && nowMs < projectile.lastTrailAt + TRAIL_SPAWN_INTERVAL_MS) {
      return;
    }
    projectile.lastTrailAt = nowMs;

    this.#segmentLines.spawnSegment(
      start,
      end,
      projectileVisualColor(projectile),
      TRAIL_REMOVE_AFTER_MS,
      nowMs
    );
  }

  #spawnRocketSmoke(projectile: WorldProjectile, force = false): void {
    if (this.#shedNonCriticalThisFrame && !force) {
      return;
    }

    if (this.#rocketSmoke === null) {
      return;
    }

    const nowMs = this.#projectileTickNowMs;
    if (!force && nowMs < projectile.lastSmokeAt + ROCKET_SMOKE_SPAWN_INTERVAL_MS) {
      return;
    }
    projectile.lastSmokeAt = nowMs;
    this.#rocketSmoke.spawnPuff(
      projectile.position.x,
      projectile.position.y,
      projectile.position.z,
      projectile.direction.x,
      projectile.direction.y,
      projectile.direction.z,
      nowMs
    );
  }

  #removeProjectile(projectile: WorldProjectile): void {
    if (!this.#projectileById.has(projectile.id)) {
      return;
    }

    const index = this.#projectiles.indexOf(projectile);
    if (index < 0) {
      this.#projectileById.delete(projectile.id);
      return;
    }

    this.#removeProjectileAt(index);
  }

  #removeProjectileAt(index: number): void {
    const lastIndex = this.#projectiles.length - 1;
    if (index < 0 || index > lastIndex) {
      return;
    }

    const projectile = this.#projectiles[index];
    this.#projectileById.delete(projectile.id);
    if (projectile.flySlot !== null) {
      this.#audio.detachProjectileFly(projectile.flySlot);
    }
    if (projectile.instanced !== null && this.#sphereInstancing !== null) {
      this.#sphereInstancing.releaseProjectile(projectile.instanced);
    }
    if (projectile.boltInstanced !== null && this.#boltInstancing !== null) {
      this.#boltInstancing.releaseBolt(projectile.boltInstanced);
    }
    if (projectile.lightSlot >= 0) {
      releaseRedeemerFlightLight(this.#pointLightPool, projectile.lightSlot);
    }
    if (projectile.object !== null) {
      disposeSceneProjectileVisual(projectile.object, this.#scene);
    }
    releaseProjectileVectors(projectile);
    if (index !== lastIndex) {
      this.#projectiles[index] = this.#projectiles[lastIndex];
    }
    this.#projectiles.length = lastIndex;
  }

  #applyProjectileVisualScale(object: Object3D, visualScale: number): void {
    resetProjectileTransform(object);
    if (visualScale !== 1) {
      object.scale.setScalar(visualScale);
    }
  }
}


export function eachProjectileDirection(
  direction: Vector3,
  count: number,
  spreadRadians: number,
  visit: (direction: Vector3, index: number) => void
): void {
  const shotCount = Math.min(Math.max(count, 1), MAX_PROJECTILE_SPREAD);
  if (shotCount <= 1 || spreadRadians <= 0) {
    visit(direction, 0);
    return;
  }

  const forward = _spreadDirections[0].copy(direction).normalize();
  _spreadRight.crossVectors(forward, _worldUp).normalize();
  if (_spreadRight.lengthSq() <= 0.001) {
    _spreadRight.set(1, 0, 0);
  }
  _spreadUp.crossVectors(_spreadRight, forward).normalize();

  for (let index = 0; index < shotCount; index += 1) {
    const angle = (Math.PI * 2 * index) / shotCount;
    const ring = index === 0 ? 0 : spreadRadians;
    _spreadOffset
      .copy(_spreadRight)
      .multiplyScalar(Math.cos(angle) * ring)
      .addScaledVector(_spreadUp, Math.sin(angle) * ring);
    const out = _spreadDirections[index];
    out.copy(forward).add(_spreadOffset).normalize();
    visit(out, index);
  }
}

export function applyLobBiasInto(direction: Vector3, upBias: number, out: Vector3): Vector3 {
  return out.copy(direction).addScaledVector(_worldUp, upBias).normalize();
}

function reflectDirectionInto(direction: Vector3, surfaceNormal: Vector3, out: Vector3): Vector3 {
  _reflectNormal.copy(surfaceNormal).normalize();
  if (direction.dot(_reflectNormal) > 0) {
    _reflectNormal.multiplyScalar(-1);
  }

  const normalDot = direction.dot(_reflectNormal);
  return out.copy(direction).addScaledVector(_reflectNormal, -2 * normalDot).normalize();
}

function eachLowShrapnelDirection(
  incomingVelocity: Vector3,
  hitNormal: Vector3,
  count: number,
  spreadRadians: number,
  arcUpBias: number,
  visit: (direction: Vector3) => void
): void {
  if (incomingVelocity.lengthSq() > 0.25) {
    reflectDirectionInto(incomingVelocity, hitNormal, _shrapnelBase);
  } else {
    _shrapnelBase.set(hitNormal.x, 0, hitNormal.z);
  }

  _shrapnelBase.y *= 0.12;
  if (_shrapnelBase.lengthSq() <= 0.001) {
    _shrapnelBase.set(1, 0, 0);
  }
  _shrapnelBase.normalize();

  _shrapnelRight.crossVectors(_shrapnelBase, _worldUp).normalize();
  if (_shrapnelRight.lengthSq() <= 0.001) {
    _shrapnelRight.set(1, 0, 0);
  }
  _shrapnelTangentUp.crossVectors(_shrapnelRight, _shrapnelBase).normalize();

  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count;
    _shrapnelDirection
      .copy(_shrapnelBase)
      .addScaledVector(_shrapnelRight, Math.cos(angle) * spreadRadians)
      .addScaledVector(_shrapnelTangentUp, Math.sin(angle) * spreadRadians)
      .addScaledVector(_worldUp, arcUpBias)
      .normalize();
    visit(_shrapnelDirection);
  }
}

function projectileVisualColor(projectile: WorldProjectile): number {
  return projectile.fire.projectileColor ?? projectile.weapon.color;
}

function isProjectileOutOfBounds(position: Vector3): boolean {
  const halfW = FUNNEL_DIMENSIONS.width * 0.5 + PROJECTILE_OOB_MARGIN_M;
  const halfL = FUNNEL_DIMENSIONS.length * 0.5 + PROJECTILE_OOB_MARGIN_M;
  const maxY = FUNNEL_DIMENSIONS.height + PROJECTILE_OOB_MARGIN_M;
  return (
    Math.abs(position.x) > halfW ||
    Math.abs(position.z) > halfL ||
    position.y > maxY ||
    position.y < -PROJECTILE_OOB_MARGIN_M
  );
}

