/** Rapier interaction bit — lower 16 = membership, upper 16 = filter. */
export const COLLISION_GROUP_ENVIRONMENT = 0b0001;
export const COLLISION_GROUP_ACTOR = 0b0010;
export const COLLISION_GROUP_PICKUP = 0b0100;

export function collisionGroups(memberships: number, filter: number): number {
  return (memberships & 0xffff) | ((filter & 0xffff) << 16);
}

/** Shell, static props, rain debris — collides with actors + pickups. */
export const ENVIRONMENT_COLLISION_GROUPS = collisionGroups(
  COLLISION_GROUP_ENVIRONMENT,
  COLLISION_GROUP_ENVIRONMENT | COLLISION_GROUP_ACTOR | COLLISION_GROUP_PICKUP
);

/**
 * Player + bot capsules — walk through pickups; collide with world + each other.
 * Also pass as `filterGroups` to `KinematicCharacterController.computeColliderMovement`.
 */
export const ACTOR_COLLISION_GROUPS = collisionGroups(
  COLLISION_GROUP_ACTOR,
  COLLISION_GROUP_ENVIRONMENT | COLLISION_GROUP_ACTOR
);

/** Health/shield pickups — tumble on environment; actors + combat rays pass through. */
export const PICKUP_COLLISION_GROUPS = collisionGroups(
  COLLISION_GROUP_PICKUP,
  COLLISION_GROUP_ENVIRONMENT | COLLISION_GROUP_PICKUP
);

/**
 * Rapier `castRay` / `castShape` filterGroups — full interaction word, not membership bits alone.
 * Actor perspective: hits environment + actors, skips pickups.
 */
export const ACTOR_RAY_QUERY_GROUPS = ACTOR_COLLISION_GROUPS;
