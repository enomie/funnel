import type { Object3D } from 'three/webgpu';
import type { RigidBody } from '@dimforge/rapier3d-simd-compat';
import { actorVisualYaw, type ActorDeathSnapshot } from '../player/actor-death';

export interface SyncedBody {
  object: Object3D;
  body: RigidBody;
}

export function syncRigidBodyObjects(items: readonly SyncedBody[]): void {
  for (const item of items) {
    item.object.position.copy(item.body.translation());
    item.object.quaternion.copy(item.body.rotation());
  }
}

/** Capsule center + yaw on visual root — player + bots, after `world.step`. */
export function syncHumanoidVisualRoot(
  body: RigidBody,
  root: Object3D,
  deathSnapshot: ActorDeathSnapshot,
  liveYaw: number
): void {
  root.position.copy(body.translation());
  root.rotation.y = actorVisualYaw(deathSnapshot, liveYaw);
}
