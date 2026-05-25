import type { Collider } from '@dimforge/rapier3d-simd-compat';
import { Mesh, MeshBasicMaterial, Object3D, Vector3 } from 'three/webgpu';
import { PLAYER_CONFIG } from '../config/game-config';
import {
  isProjectileGlowMeshName,
  projectileGlowLayerOpacity,
  projectileGlowMeshLayerIndex
} from './projectile-materials';
import type { ActorRegistry } from './actor-registry';
import type { CombatActor } from './combat-actor';
import type { ImpactProfile, ProjectileVisualKind } from './weapon-definitions';

/** Fresh Ripper disk — one full health bar (shield first, then HP). */
export const RIPPER_KILL_DAMAGE = 100;
export const RIPPER_RICOCHET_MAX = 5;

/** Matches `PROJECTILE_RADIUS.ripper` in `projectile-visuals.ts`. */
const RIPPER_VISUAL_RADIUS = 0.32;
const RIPPER_HIT_RADIUS_FACTOR = 1.12;

const _offset = new Vector3();
const _resultHitPoint = new Vector3();
const RIPPER_SPENT_IMPACT_RADIUS = 0.06;

export interface RipperActorStepHit {
  actor: CombatActor;
  collider: Collider;
  point: Vector3;
  distance: number;
}

/** Swept disk radius — scales with `projectileScale` (RMB wider = more reach). */
export function ripperHitRadius(visualScale: number): number {
  return RIPPER_VISUAL_RADIUS * visualScale * RIPPER_HIT_RADIUS_FACTOR;
}

/**
 * Closest actor grazed by the disk along `[origin, origin + direction * maxDistance]`.
 * Wider RMB disks use a larger sweep; damage stays in `resolveRipperImpactAt`.
 */
export function findFirstRipperActorAlongStep(
  registry: ActorRegistry,
  origin: Vector3,
  direction: Vector3,
  maxDistance: number,
  diskRadius: number,
  excludeActorId?: string
): RipperActorStepHit | null {
  if (maxDistance <= 0) {
    return null;
  }

  const dir = _offset.copy(direction).normalize();
  const sweepRadius = diskRadius + PLAYER_CONFIG.radius;
  const queryRadius = maxDistance + sweepRadius;
  let best: RipperActorStepHit | null = null;

  registry.forEachActorNear(origin.x, origin.y, origin.z, queryRadius, (actor) => {
    if (actor.id === excludeActorId) {
      return;
    }

    const center = actor.body.translation();
    const distance = raySphereHitDistance(
      origin,
      dir,
      center.x,
      center.y,
      center.z,
      sweepRadius
    );
    if (distance === null || distance > maxDistance) {
      return;
    }

    if (best !== null && distance >= best.distance) {
      return;
    }

    _resultHitPoint.copy(dir).multiplyScalar(distance).add(origin);
    best = { actor, collider: actor.colliders[0], point: _resultHitPoint, distance };
  });

  return best;
}

export function ripperDirectDamage(
  ricochetsRemaining: number,
  ricochetMax: number,
  baseDamage: number
): number {
  if (ricochetMax <= 0 || baseDamage <= 0) {
    return baseDamage;
  }

  return Math.max(0, (baseDamage * ricochetsRemaining) / ricochetMax);
}

export function ripperPowerFraction(ricochetsRemaining: number, ricochetMax: number): number {
  if (ricochetMax <= 0) {
    return 1;
  }

  return Math.max(0, ricochetsRemaining / ricochetMax);
}

export function resolveRipperImpactAt(
  visualKind: ProjectileVisualKind,
  impact: ImpactProfile,
  ricochetsRemaining: number
): ImpactProfile {
  if (visualKind !== 'ripper' || impact.ricochetMax <= 0) {
    return impact;
  }

  const directDamage = ripperDirectDamage(
    ricochetsRemaining,
    impact.ricochetMax,
    impact.directDamage
  );

  return {
    ...impact,
    directDamage,
    impactRadius: directDamage > 0 ? impact.impactRadius : RIPPER_SPENT_IMPACT_RADIUS
  };
}

/** Per-projectile glow clone — dim hull opacity after ricochets. */
export function prepareRipperProjectileVisual(object: Object3D, _baseColor: number): void {
  syncRipperProjectileFade(object, 1);
}

export function syncRipperProjectileFade(object: Object3D, powerFraction: number): void {
  const power = Math.max(0, Math.min(1, powerFraction));
  object.traverse((node) => {
    if (!(node instanceof Mesh) || !isProjectileGlowMeshName(node.name)) {
      return;
    }
    if (!(node.material instanceof MeshBasicMaterial)) {
      return;
    }
    const layerIndex = projectileGlowMeshLayerIndex(node.name);
    node.material.opacity = projectileGlowLayerOpacity(layerIndex, power);
  });
}

function raySphereHitDistance(
  origin: Vector3,
  direction: Vector3,
  centerX: number,
  centerY: number,
  centerZ: number,
  radius: number
): number | null {
  _offset.set(origin.x - centerX, origin.y - centerY, origin.z - centerZ);
  const b = _offset.dot(direction);
  const c = _offset.lengthSq() - radius * radius;
  const discriminant = b * b - c;
  if (discriminant < 0) {
    return null;
  }

  const sqrt = Math.sqrt(discriminant);
  let t = -b - sqrt;
  if (t < 0) {
    t = -b + sqrt;
  }

  return t >= 0 ? t : null;
}
