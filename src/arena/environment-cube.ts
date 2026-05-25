import RAPIER from '@dimforge/rapier3d-simd-compat';
import type { World } from '@dimforge/rapier3d-simd-compat';
import { Euler, Quaternion } from 'three/webgpu';
import type { ArenaStaticInstances } from './arena-static-instances';
import type { FunnelZoneId } from './funnel-zones';
import { createDynamicPropColliderDesc } from './environment-dynamic-shapes';
import { applyEnvironmentPhysicsColliderDesc } from './environment-physics-material';
import { ENVIRONMENT_COLLISION_GROUPS } from '../physics/collision-groups';

export const ENVIRONMENT_CUBE_SIZE_M = 5;
export const ENVIRONMENT_RAMP_SIZE_M = 5;

export const ENVIRONMENT_CUBE_HALF_M = ENVIRONMENT_CUBE_SIZE_M * 0.5;
export const ENVIRONMENT_CUBE_CENTER_Y = ENVIRONMENT_CUBE_HALF_M;
export const ENVIRONMENT_RAMP_HALF_M = ENVIRONMENT_RAMP_SIZE_M * 0.5;
export const ENVIRONMENT_RAMP_CENTER_Y = ENVIRONMENT_RAMP_HALF_M;

const _rampRotationEuler = new Euler();
const _rampRotationQuaternion = new Quaternion();

type BoxHalfExtents = readonly [number, number, number];

export function addFixedEnvironmentBox(
  instances: ArenaStaticInstances,
  world: World,
  center: readonly [number, number, number],
  size: readonly [number, number, number],
  zoneId: FunnelZoneId
): void {
  const halfExtents: BoxHalfExtents = [size[0] * 0.5, size[1] * 0.5, size[2] * 0.5];
  instances.addEnvironmentBox(zoneId, center, size);

  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(...center));
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(...halfExtents)
      .setFriction(1.1)
      .setCollisionGroups(ENVIRONMENT_COLLISION_GROUPS),
    body
  );
}

export function addFixedEnvironmentRamp(
  instances: ArenaStaticInstances,
  world: World,
  center: readonly [number, number, number],
  size: readonly [number, number, number],
  zoneId: FunnelZoneId,
  rotationY = 0,
  rotationX = 0
): void {
  const [width, height, depth] = size;
  instances.addEnvironmentRamp(zoneId, center, size, rotationY, rotationX);

  const rotation = _rampRotationQuaternion.setFromEuler(
    _rampRotationEuler.set(rotationX, rotationY, 0)
  );
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed()
      .setTranslation(...center)
      .setRotation({ w: rotation.w, x: rotation.x, y: rotation.y, z: rotation.z })
  );
  world.createCollider(
    applyEnvironmentPhysicsColliderDesc(
      createDynamicPropColliderDesc({ kind: 'ramp', width, height, depth })
    ),
    body
  );
}

export function addFixedEnvironmentCube(
  instances: ArenaStaticInstances,
  world: World,
  x: number,
  z: number,
  zoneId: FunnelZoneId
): void {
  const center: [number, number, number] = [x, ENVIRONMENT_CUBE_CENTER_Y, z];
  addFixedEnvironmentBox(
    instances,
    world,
    center,
    [ENVIRONMENT_CUBE_SIZE_M, ENVIRONMENT_CUBE_SIZE_M, ENVIRONMENT_CUBE_SIZE_M],
    zoneId
  );
}
