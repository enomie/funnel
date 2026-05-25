import RAPIER from '@dimforge/rapier3d-simd-compat';
import type { RigidBody, World } from '@dimforge/rapier3d-simd-compat';
import type { Vector3 } from 'three/webgpu';
import type { ActorRegistry } from '../combat/actor-registry';
import { ACTOR_RAY_QUERY_GROUPS } from '../physics/collision-groups';
import { HUMANOID_EYE_HEIGHT_OFFSET } from '../player/humanoid-eye-height';
import { BOT_SIGHT_RANGE_M } from './bot-objective';

const TARGET_AIM_HEIGHT_OFFSET = 0.55;
const LOS_TARGET_TOLERANCE_M = 0.4;
export const BOT_EYE_HEIGHT_OFFSET = HUMANOID_EYE_HEIGHT_OFFSET.stand;

let _losRay: RAPIER.Ray | null = null;

export interface BotPerceptionTarget {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly body: RigidBody;
}

export function hasLineOfSightToTarget(
  world: World,
  registry: ActorRegistry,
  eyeX: number,
  eyeY: number,
  eyeZ: number,
  target: BotPerceptionTarget,
  excludeBody: RigidBody
): boolean {
  const aimX = target.x;
  const aimY = target.y + TARGET_AIM_HEIGHT_OFFSET;
  const aimZ = target.z;
  const dx = aimX - eyeX;
  const dy = aimY - eyeY;
  const dz = aimZ - eyeZ;
  const distance = Math.hypot(dx, dy, dz);
  if (distance > BOT_SIGHT_RANGE_M) {
    return false;
  }
  if (distance <= 0.05) {
    return true;
  }

  const dirX = dx / distance;
  const dirY = dy / distance;
  const dirZ = dz / distance;
  if (_losRay === null) {
    _losRay = new RAPIER.Ray({ x: eyeX, y: eyeY, z: eyeZ }, { x: dirX, y: dirY, z: dirZ });
  } else {
    _losRay.origin.x = eyeX;
    _losRay.origin.y = eyeY;
    _losRay.origin.z = eyeZ;
    _losRay.dir.x = dirX;
    _losRay.dir.y = dirY;
    _losRay.dir.z = dirZ;
  }

  const hit = world.castRay(
    _losRay,
    distance,
    true,
    undefined,
    ACTOR_RAY_QUERY_GROUPS,
    undefined,
    excludeBody
  );
  if (hit === null) {
    return true;
  }

  const hitActor = registry.resolveCollider(hit.collider);
  if (hitActor !== null && hitActor.body.handle === target.body.handle) {
    return true;
  }

  return hit.timeOfImpact >= distance - LOS_TARGET_TOLERANCE_M;
}

export function aimAnglesFromEye(eye: Vector3, aim: Vector3): { yaw: number; pitch: number } {
  const dx = aim.x - eye.x;
  const dy = aim.y - eye.y;
  const dz = aim.z - eye.z;
  const planar = Math.hypot(dx, dz);
  return {
    yaw: Math.atan2(dx, dz),
    pitch: Math.atan2(dy, Math.max(planar, 0.001))
  };
}
