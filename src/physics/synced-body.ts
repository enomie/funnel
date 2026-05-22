import type { Object3D } from 'three/webgpu';
import type { RigidBody } from '@dimforge/rapier3d-simd-compat';

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
