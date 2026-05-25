// Path: /Users/johann/MyBrew/funnel-real/src/combat/apply-impact.ts

import RAPIER from '@dimforge/rapier3d-simd-compat';
import type { Collider, RigidBody, World } from '@dimforge/rapier3d-simd-compat';
import { Vector3 } from 'three/webgpu';
import { COMBAT_DAMAGE_CONFIG } from '../config/game-config';
import { ACTOR_RAY_QUERY_GROUPS } from '../physics/collision-groups';
import type { GameEventBus } from '../core/event-bus';
import type { ActorRegistry } from './actor-registry';
import type { CombatActor } from './combat-actor';
import { areSameFaction, type FactionTeam } from './teams';
import type { ImpactProfile } from './weapon-definitions';

const SPLASH_CENTER_FRACTION = 1;
const SPLASH_EDGE_FRACTION = 0.35;

const LETHAL_DAMAGE = 9999;

const SPLASH_AIM_Y_OFFSET = 0.55;

const SPLASH_LOS_TOLERANCE_M = 0.35;

/** Capsule outer reach — expanding lethal kills when the wave hits the hull, not the body center. */
const EXPANDING_LETHAL_ACTOR_REACH_M = 0.95;

let _splashLosRay: RAPIER.Ray | null = null;

export interface ApplyImpactRequest {
  sourceFaction: FactionTeam;
  sourceActorId?: string;
  impact: ImpactProfile;
  point: Vector3;
  hitCollider?: Collider;
}

export interface ApplyImpactDeps {
  registry: ActorRegistry;
  bus: GameEventBus;
  world: World;
}


export type CombatImpactRequest = Omit<ApplyImpactRequest, 'sourceFaction'>;

export interface CombatImpactSink {
  apply(request: CombatImpactRequest): void;
}

export function applyImpact(deps: ApplyImpactDeps, request: ApplyImpactRequest): void {
  const directTarget =
    request.hitCollider !== undefined
      ? deps.registry.resolveCollider(request.hitCollider)
      : null;

  if (directTarget !== null) {
    applyDirectDamage(
      deps,
      request.sourceFaction,
      request.sourceActorId,
      directTarget,
      request.impact
    );
  }

  if (request.impact.impactRadius <= 0) {
    return;
  }

  applySplashDamage(
    deps,
    request.sourceFaction,
    request.sourceActorId,
    request.point,
    request.impact,
    directTarget
  );
}

function applyDirectDamage(
  deps: ApplyImpactDeps,
  sourceFaction: FactionTeam,
  sourceActorId: string | undefined,
  target: CombatActor,
  impact: ImpactProfile
): void {
  if (!canDamageTarget(sourceFaction, target, impact.splashFriendlyFire === true)) {
    return;
  }

  const amount = resolveDamageAmount(impact, impact.directDamage, 1);
  if (amount <= 0) {
    return;
  }

  damageActor(deps, sourceFaction, sourceActorId, target, amount);
}

function applySplashDamage(
  deps: ApplyImpactDeps,
  sourceFaction: FactionTeam,
  sourceActorId: string | undefined,
  center: Vector3,
  impact: ImpactProfile,
  directTarget: CombatActor | null
): void {
  const { impactRadius, directDamage } = impact;
  if (impactRadius <= 0) {
    return;
  }

  if (!impact.lethalSplash && directDamage <= 0) {
    return;
  }

  const friendlyFire = impact.splashFriendlyFire === true;
  const excludeBody = resolveSourceBody(deps, sourceActorId);
  deps.registry.forEachActorNear(
    center.x,
    center.y,
    center.z,
    impactRadius,
    (actor) => {
      if (!canDamageTarget(sourceFaction, actor, friendlyFire)) {
        return;
      }

      if (actor === directTarget) {
        return;
      }

      const bodyPoint = actor.body.translation();
      const dx = bodyPoint.x - center.x;
      const dy = bodyPoint.y - center.y;
      const dz = bodyPoint.z - center.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (!hasSplashLineOfSight(deps, center, actor, excludeBody)) {
        return;
      }

      const falloff = 1 - dist / impactRadius;
      const amount = resolveDamageAmount(impact, directDamage, falloff);
      damageActor(deps, sourceFaction, sourceActorId, actor, amount);
    }
  );
}

function resolveDamageAmount(impact: ImpactProfile, baseDamage: number, falloff: number): number {
  if (impact.lethalSplash) {
    return LETHAL_DAMAGE;
  }

  if (baseDamage <= 0) {
    return 0;
  }

  return (
    baseDamage *
    (SPLASH_EDGE_FRACTION + (SPLASH_CENTER_FRACTION - SPLASH_EDGE_FRACTION) * falloff)
  );
}

function canDamageTarget(
  sourceFaction: FactionTeam,
  target: CombatActor,
  friendlyFire: boolean
): boolean {
  if (target.health.isDead) {
    return false;
  }

  if (friendlyFire) {
    return true;
  }

  return !areSameFaction(sourceFaction, target.getFaction());
}

function resolveWeaponDamageAmount(target: CombatActor, amount: number): number {
  if (amount >= LETHAL_DAMAGE) {
    return amount;
  }

  const minAmount = target.health.maxHealth * COMBAT_DAMAGE_CONFIG.minHealthFraction;
  return Math.max(amount, minAmount);
}

function damageActor(
  deps: ApplyImpactDeps,
  sourceFaction: FactionTeam,
  sourceActorId: string | undefined,
  target: CombatActor,
  amount: number
): void {
  if (amount <= 0 || target.health.isDead) {
    return;
  }

  const resolvedAmount = resolveWeaponDamageAmount(target, amount);
  const result = target.health.damage(resolvedAmount);

  deps.bus.emit('actor-damaged', {
    actorId: target.id,
    amount: resolvedAmount,
    remaining: result.remainingHealth,
    remainingShield: result.remainingShield,
    sourceFaction,
    sourceActorId
  });

  if (result.remainingHealth <= 0) {
    deps.bus.emit('actor-died', {
      actorId: target.id,
      faction: target.getFaction(),
      sourceFaction,
      sourceActorId
    });
  }
}

export interface ExpandingLethalBlastTick {
  sourceFaction: FactionTeam;
  sourceActorId?: string;
  center: Vector3;
  currentRadius: number;
  killedActorIds: Set<string>;
  friendlyFire: boolean;
  lastSweepMs: number;
}

function actorWithinExpandingLethalRadius(
  center: Vector3,
  actor: CombatActor,
  currentRadius: number
): boolean {
  const bodyPoint = actor.body.translation();
  const dx = bodyPoint.x - center.x;
  const dy = bodyPoint.y - center.y;
  const dz = bodyPoint.z - center.z;
  const centerDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return centerDistance - EXPANDING_LETHAL_ACTOR_REACH_M <= currentRadius;
}

export function tickExpandingLethalBlast(
  deps: ApplyImpactDeps,
  tick: ExpandingLethalBlastTick,
  nowMs: number
): void {
  if (tick.currentRadius <= 0) {
    return;
  }

  if (nowMs - tick.lastSweepMs < 50) {
    return;
  }

  tick.lastSweepMs = nowMs;

  const queryRadius = tick.currentRadius + EXPANDING_LETHAL_ACTOR_REACH_M;
  deps.registry.forEachActorNear(
    tick.center.x,
    tick.center.y,
    tick.center.z,
    queryRadius,
    (actor) => {
      if (tick.killedActorIds.has(actor.id)) {
        return;
      }

      if (!canDamageTarget(tick.sourceFaction, actor, tick.friendlyFire)) {
        return;
      }

      if (!actorWithinExpandingLethalRadius(tick.center, actor, tick.currentRadius)) {
        return;
      }

      tick.killedActorIds.add(actor.id);
      damageActor(deps, tick.sourceFaction, tick.sourceActorId, actor, LETHAL_DAMAGE);
    }
  );
}

export function killActorFromBlastDirectHit(
  deps: ApplyImpactDeps,
  sourceFaction: FactionTeam,
  sourceActorId: string | undefined,
  hitCollider: Collider,
  killedActorIds: Set<string>,
  friendlyFire: boolean
): void {
  const target = deps.registry.resolveCollider(hitCollider);
  if (target === null || target.health.isDead || killedActorIds.has(target.id)) {
    return;
  }

  if (!canDamageTarget(sourceFaction, target, friendlyFire)) {
    return;
  }

  killedActorIds.add(target.id);
  damageActor(deps, sourceFaction, sourceActorId, target, LETHAL_DAMAGE);
}

function resolveSourceBody(deps: ApplyImpactDeps, sourceActorId: string | undefined): RigidBody | null {
  if (sourceActorId === undefined) {
    return null;
  }

  return deps.registry.resolveActor(sourceActorId)?.body ?? null;
}

function splashLosRay(originX: number, originY: number, originZ: number, dirX: number, dirY: number, dirZ: number): RAPIER.Ray {
  if (_splashLosRay === null) {
    _splashLosRay = new RAPIER.Ray(
      { x: originX, y: originY, z: originZ },
      { x: dirX, y: dirY, z: dirZ }
    );
    return _splashLosRay;
  }

  _splashLosRay.origin.x = originX;
  _splashLosRay.origin.y = originY;
  _splashLosRay.origin.z = originZ;
  _splashLosRay.dir.x = dirX;
  _splashLosRay.dir.y = dirY;
  _splashLosRay.dir.z = dirZ;
  return _splashLosRay;
}


function hasSplashLineOfSight(
  deps: ApplyImpactDeps,
  center: Vector3,
  target: CombatActor,
  excludeBody: RigidBody | null
): boolean {
  const bodyPoint = target.body.translation();
  const aimX = bodyPoint.x;
  const aimY = bodyPoint.y + SPLASH_AIM_Y_OFFSET;
  const aimZ = bodyPoint.z;
  const dx = aimX - center.x;
  const dy = aimY - center.y;
  const dz = aimZ - center.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (distance <= 0.05) {
    return true;
  }

  const dirX = dx / distance;
  const dirY = dy / distance;
  const dirZ = dz / distance;
  const ray = splashLosRay(center.x, center.y, center.z, dirX, dirY, dirZ);
  const hit = deps.world.castRay(
    ray,
    distance,
    true,
    undefined,
    ACTOR_RAY_QUERY_GROUPS,
    undefined,
    excludeBody ?? undefined
  );
  if (hit === null) {
    return true;
  }

  const hitActor = deps.registry.resolveCollider(hit.collider);
  if (hitActor !== null && hitActor.id === target.id) {
    return true;
  }

  return hit.timeOfImpact >= distance - SPLASH_LOS_TOLERANCE_M;
}
