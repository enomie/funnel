// Path: /Users/johann/MyBrew/funnel-real/src/physics/collision-groups.ts


export const COLLISION_GROUP_ENVIRONMENT = 0b0001;
export const COLLISION_GROUP_ACTOR = 0b0010;
export const COLLISION_GROUP_PICKUP = 0b0100;

export function collisionGroups(memberships: number, filter: number): number {
  return (memberships & 0xffff) | ((filter & 0xffff) << 16);
}


export const ENVIRONMENT_COLLISION_GROUPS = collisionGroups(
  COLLISION_GROUP_ENVIRONMENT,
  COLLISION_GROUP_ENVIRONMENT | COLLISION_GROUP_ACTOR | COLLISION_GROUP_PICKUP
);


export const ACTOR_COLLISION_GROUPS = collisionGroups(
  COLLISION_GROUP_ACTOR,
  COLLISION_GROUP_ENVIRONMENT | COLLISION_GROUP_ACTOR
);


export const PICKUP_COLLISION_GROUPS = collisionGroups(
  COLLISION_GROUP_PICKUP,
  COLLISION_GROUP_ENVIRONMENT | COLLISION_GROUP_PICKUP
);


export const ACTOR_RAY_QUERY_GROUPS = ACTOR_COLLISION_GROUPS;
