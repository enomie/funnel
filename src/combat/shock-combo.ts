// Path: /Users/johann/MyBrew/funnel-real/src/combat/shock-combo.ts

import { Vector3 } from 'three/webgpu';
import { projectileCoreRadius } from './projectile-visuals';


export const SHOCK_ORB_PROJECTILE_TAG = 'shock-orb';


export const SHOCK_ORB_SOLO_KILL_RADIUS_FACTOR = 6;

export const SHOCK_COMBO_KILL_RADIUS_FACTOR = 5;

/** Solo orb kill sphere — gameplay + VFX expansion. */
export const SHOCK_ORB_SOLO_EXPAND_MS = 720;

/** Combo detonation — slower shockwave than solo orb. */
export const SHOCK_ORB_COMBO_EXPAND_MS = 960;

const SHOCK_ORB_HIT_RADIUS_FACTOR = 1.1;

const _offset = new Vector3();
const _listTargetPositionScratch: Vector3[] = [];

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
  /** Snapshot — not tied to pooled projectile vectors. */
  readonly position: Vector3;
  hitRadius: number;
}

/** Hit point is plain coordinates so callers never hold pooled Vector3 refs. */
export interface ShockOrbRayHit {
  projectileId: number;
  x: number;
  y: number;
  z: number;
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

    let position: Vector3;
    if (targets.length >= _listTargetPositionScratch.length) {
      position = new Vector3();
      _listTargetPositionScratch.push(position);
    } else {
      position = _listTargetPositionScratch[targets.length];
    }
    position.copy(projectile.position);

    targets.push({
      projectileId: projectile.id,
      position,
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
      const hitX = origin.x + direction.x * distance;
      const hitY = origin.y + direction.y * distance;
      const hitZ = origin.z + direction.z * distance;
      best = {
        projectileId: orb.projectileId,
        x: hitX,
        y: hitY,
        z: hitZ,
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
