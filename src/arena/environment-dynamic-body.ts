// Path: /Users/johann/MyBrew/funnel-real/src/arena/environment-dynamic-body.ts

import RAPIER from '@dimforge/rapier3d-simd-compat';
import type { World } from '@dimforge/rapier3d-simd-compat';
import type { Quaternion } from 'three/webgpu';
import type { DynamicEnvironmentInstances, DynamicSyncedBody } from './environment-dynamic-instances';
import {
  createDynamicPropColliderDesc,
  type DynamicPropSpec
} from './environment-dynamic-shapes';
import { applyEnvironmentPhysicsColliderDesc } from './environment-physics-material';
import { clampRainDropX, clampRainDropZ, rainSpawnY } from './environment-rain-bounds';

type PropCenter = readonly [number, number, number];


export function computeRainSpawnCenter(x: number, z: number): PropCenter {
  return [clampRainDropX(x), rainSpawnY(), clampRainDropZ(z)];
}

export function createDynamicEnvironmentProp(
  instances: DynamicEnvironmentInstances,
  world: World,
  shape: DynamicPropSpec,
  position: PropCenter,
  rotation: Quaternion
): DynamicSyncedBody {
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(...position)
      .setRotation({ w: rotation.w, x: rotation.x, y: rotation.y, z: rotation.z })
  );
  world.createCollider(
    applyEnvironmentPhysicsColliderDesc(createDynamicPropColliderDesc(shape)),
    body
  );
  body.wakeUp();

  return instances.attachBody(shape, body);
}
