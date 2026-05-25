// Path: /Users/johann/MyBrew/funnel-real/src/combat/shock-combo.ts

import { Vector3 } from 'three/webgpu';
import { projectileCoreRadius } from './projectile-visuals';


export const SHOCK_ORB_PROJECTILE_TAG = 'shock-orb';


export const SHOCK_ORB_SOLO_KILL_RADIUS_FACTOR = 6;

export const SHOCK_COMBO_KILL_RADIUS_FACTOR = 5;

const SHOCK_ORB_HIT_RADIUS_FACTOR = 1.1;

const _offset = new Vector3();
const _orbHitPoint = new Vector3();

export function shockOrbVisualRadius(visualScale: number): number {
  return projectileCoreRadius('shock') * visualScale;
}

export function shockOrbSoloKillRadiusM(visualScale: number): number {
  return shockOrbVisualRadius(visualScale) * SHOCK_ORB_SOLO_KILL_RADIUS_FACTOR;
}

export function shockOrbComboKillRadiusM(visualScale: number): number {
  return shockOrbSoloKillRadiusM(visualScale) * SHOCK_COMBO_KILL_RADIUS_FACTOR;
}

export interface ShockOrbTarget {
  projectileId: number;
  position: Vector3;
  hitRadius: number;
}

export interface ShockOrbRayHit {
  projectileId: number;
  point: Vector3;
  distance: number;
}

export function shockOrbHitRadius(visualScale: number): number {
  return shockOrbVisualRadius(visualScale) * SHOCK_ORB_HIT_RADIUS_FACTOR;
}

export function projectileIsShockOrb(tags: readonly string[]): boolean {
  return tags.includes(SHOCK_ORB_PROJECTILE_TAG);
}

export function listShockOrbTargets(
  projectiles: readonly {
    id: number;
    tags: readonly string[];
    position: Vector3;
    visualScale: number;
  }[]
): ShockOrbTarget[] {
  const targets: ShockOrbTarget[] = [];

  for (let index = 0; index < projectiles.length; index += 1) {
    const projectile = projectiles[index];
    if (!projectileIsShockOrb(projectile.tags)) {
      continue;
    }

    targets.push({
      projectileId: projectile.id,
      position: projectile.position,
      hitRadius: shockOrbHitRadius(projectile.visualScale)
    });
  }

  return targets;
}


export function findFirstShockOrbAlongRay(
  origin: Vector3,
  direction: Vector3,
  maxDistance: number,
  orbs: readonly ShockOrbTarget[],
  excludeProjectileId = -1
): ShockOrbRayHit | null {
  if (orbs.length === 0 || maxDistance <= 0) {
    return null;
  }

  let best: ShockOrbRayHit | null = null;

  for (const orb of orbs) {
    if (orb.projectileId === excludeProjectileId) {
      continue;
    }

    const distance = raySphereDistance(origin, direction, orb.position, orb.hitRadius);
    if (distance === null || distance > maxDistance) {
      continue;
    }

    if (best === null || distance < best.distance) {
      _orbHitPoint.copy(origin).addScaledVector(direction, distance);
      best = {
        projectileId: orb.projectileId,
        point: _orbHitPoint,
        distance
      };
    }
  }

  return best;
}

function raySphereDistance(
  origin: Vector3,
  direction: Vector3,
  center: Vector3,
  radius: number
): number | null {
  _offset.copy(origin).sub(center);
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
