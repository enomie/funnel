// Path: /Users/johann/MyBrew/funnel-real/src/render/rocket-smoke-trail-instancing.ts

import {
  InstancedMesh,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3
} from 'three/webgpu';
import { hiddenInstanceMatrix } from './instance-hidden-matrix';
import { rocketSmokeTrailMaterial } from './materials/rocket-smoke-trail-tsl';

export const ROCKET_SMOKE_SPAWN_INTERVAL_MS = 28;
export const ROCKET_SMOKE_PUFF_LIFETIME_MS = 580;
export const ROCKET_SMOKE_PUFFS_MAX = 96;

const ROCKET_SMOKE_TRAIL_OFFSET_M = 0.24;
const ROCKET_SMOKE_PUFF_SIZE_MIN = 0.1;
const ROCKET_SMOKE_PUFF_SIZE_MAX = 0.36;

const _direction = new Vector3();
const _dummy = new Object3D();

interface ActiveSmokePuff {
  slot: number;
  spawnedAtMs: number;
  x: number;
  y: number;
  z: number;
}

let unitSmokeGeometry: PlaneGeometry | null = null;

function getUnitSmokeGeometry(): PlaneGeometry {
  if (unitSmokeGeometry === null) {
    unitSmokeGeometry = new PlaneGeometry(1, 1);
  }
  return unitSmokeGeometry;
}


export class RocketSmokeTrailInstancingService {
  readonly #scene: Scene;
  readonly #camera: PerspectiveCamera;
  readonly #mesh: InstancedMesh;
  readonly #lifetimeData: Float32Array;
  readonly #freeSlots: number[] = [];
  readonly #inUse = new Uint8Array(ROCKET_SMOKE_PUFFS_MAX);
  readonly #active: ActiveSmokePuff[] = [];
  #maxSlotUsed = -1;

  constructor(scene: Scene, camera: PerspectiveCamera) {
    this.#scene = scene;
    this.#camera = camera;
    this.#lifetimeData = new Float32Array(ROCKET_SMOKE_PUFFS_MAX);
    this.#mesh = new InstancedMesh(
      getUnitSmokeGeometry(),
      rocketSmokeTrailMaterial(this.#lifetimeData),
      ROCKET_SMOKE_PUFFS_MAX
    );
    this.#mesh.name = 'instanced-rocket-smoke';
    this.#mesh.frustumCulled = false;
    this.#mesh.castShadow = false;
    this.#mesh.receiveShadow = false;
    this.#mesh.renderOrder = 11;
    this.#mesh.count = 0;

    for (let slot = ROCKET_SMOKE_PUFFS_MAX - 1; slot >= 0; slot -= 1) {
      this.#freeSlots.push(slot);
      this.#mesh.setMatrixAt(slot, hiddenInstanceMatrix());
      this.#lifetimeData[slot] = 0;
    }
    this.#mesh.instanceMatrix.needsUpdate = true;
    this.#scene.add(this.#mesh);
  }

  spawnPuff(
    x: number,
    y: number,
    z: number,
    dirX: number,
    dirY: number,
    dirZ: number,
    spawnedAtMs: number
  ): void {
    _direction.set(dirX, dirY, dirZ);
    if (_direction.lengthSq() <= 0.0001) {
      _direction.set(0, 0, 1);
    } else {
      _direction.normalize();
    }

    const slot = this.#acquireSlot();
    if (slot === undefined) {
      return;
    }

    this.#inUse[slot] = 1;
    this.#maxSlotUsed = Math.max(this.#maxSlotUsed, slot);
    const puff: ActiveSmokePuff = {
      slot,
      spawnedAtMs,
      x: x - _direction.x * ROCKET_SMOKE_TRAIL_OFFSET_M,
      y: y - _direction.y * ROCKET_SMOKE_TRAIL_OFFSET_M,
      z: z - _direction.z * ROCKET_SMOKE_TRAIL_OFFSET_M
    };
    this.#active.push(puff);
    this.#syncPuffSlot(puff, spawnedAtMs);
    this.#mesh.instanceMatrix.needsUpdate = true;
  }

  #acquireSlot(): number | undefined {
    let slot = this.#freeSlots.pop();
    if (slot !== undefined) {
      return slot;
    }

    if (this.#active.length === 0) {
      return undefined;
    }

    const evicted = this.#active[0];
    this.#releaseSlot(evicted.slot);
    this.#active[0] = this.#active[this.#active.length - 1];
    this.#active.length -= 1;
    slot = this.#freeSlots.pop();
    return slot;
  }

  tick(nowMs: number): void {
    let matrixDirty = false;

    for (let index = this.#active.length - 1; index >= 0; index -= 1) {
      const puff = this.#active[index];
      const elapsed = nowMs - puff.spawnedAtMs;
      if (elapsed >= ROCKET_SMOKE_PUFF_LIFETIME_MS) {
        this.#releaseSlot(puff.slot);
        matrixDirty = true;
        this.#active[index] = this.#active[this.#active.length - 1];
        this.#active.length -= 1;
        continue;
      }

      this.#syncPuffSlot(puff, nowMs);
      matrixDirty = true;
    }

    if (matrixDirty) {
      this.#mesh.instanceMatrix.needsUpdate = true;
    }
  }

  hasActive(): boolean {
    return this.#active.length > 0;
  }

  clearAll(): void {
    for (const puff of this.#active) {
      this.#releaseSlot(puff.slot);
    }
    this.#active.length = 0;
    this.#mesh.instanceMatrix.needsUpdate = true;
  }

  #syncPuffSlot(puff: ActiveSmokePuff, nowMs: number): void {
    const progress = Math.min(1, (nowMs - puff.spawnedAtMs) / ROCKET_SMOKE_PUFF_LIFETIME_MS);
    const grow = Math.min(1, progress * 2.8);
    const fade = 1 - progress;
    const size =
      ROCKET_SMOKE_PUFF_SIZE_MIN +
      (ROCKET_SMOKE_PUFF_SIZE_MAX - ROCKET_SMOKE_PUFF_SIZE_MIN) * grow;
    const lifetimeLeft = fade * fade;

    _dummy.position.set(puff.x, puff.y, puff.z);
    _dummy.scale.setScalar(size);
    _dummy.lookAt(this.#camera.position);
    _dummy.updateMatrix();
    this.#mesh.setMatrixAt(puff.slot, _dummy.matrix);
    this.#lifetimeData[puff.slot] = lifetimeLeft;
    this.#mesh.count = this.#maxSlotUsed + 1;
  }

  #releaseSlot(slot: number): void {
    if (this.#inUse[slot] === 0) {
      return;
    }

    this.#mesh.setMatrixAt(slot, hiddenInstanceMatrix());
    this.#lifetimeData[slot] = 0;
    this.#inUse[slot] = 0;
    this.#freeSlots.push(slot);
    if (slot === this.#maxSlotUsed) {
      while (this.#maxSlotUsed >= 0 && this.#inUse[this.#maxSlotUsed] === 0) {
        this.#maxSlotUsed -= 1;
      }
    }
    this.#mesh.count = this.#maxSlotUsed >= 0 ? this.#maxSlotUsed + 1 : 0;
  }
}
