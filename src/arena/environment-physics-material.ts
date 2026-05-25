import type { ColliderDesc } from '@dimforge/rapier3d-simd-compat';
import {
  ENVIRONMENT_COLLISION_GROUPS,
  PICKUP_COLLISION_GROUPS
} from '../physics/collision-groups';

/** kg/m³ — mass from collider volume only (no setMass on rain props). */
export const ENVIRONMENT_PHYSICS_DENSITY = 900;

export const ENVIRONMENT_PHYSICS_FRICTION = 1.1;
export const ENVIRONMENT_PHYSICS_RESTITUTION = 0.35;

export function applyEnvironmentPhysicsColliderDesc(desc: ColliderDesc): ColliderDesc {
  return desc
    .setDensity(ENVIRONMENT_PHYSICS_DENSITY)
    .setFriction(ENVIRONMENT_PHYSICS_FRICTION)
    .setRestitution(ENVIRONMENT_PHYSICS_RESTITUTION)
    .setCollisionGroups(ENVIRONMENT_COLLISION_GROUPS);
}

export function applyPickupPhysicsColliderDesc(
  desc: ColliderDesc,
  density: number
): ColliderDesc {
  return desc
    .setDensity(density)
    .setFriction(0.55)
    .setRestitution(0.38)
    .setCollisionGroups(PICKUP_COLLISION_GROUPS);
}
