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

export const ROCKET_SMOKE_SPAWN_INTERVAL_MS = 14;
export const ROCKET_SMOKE_PUFF_LIFETIME_MS = 920;
export const ROCKET_SMOKE_PUFFS_MAX = 160;

const ROCKET_SMOKE_TRAIL_OFFSET_HOT_M = 0.12;
const ROCKET_SMOKE_TRAIL_OFFSET_COOL_M = 0.42;
const ROCKET_SMOKE_PUFF_SIZE_MIN = 0.24;
const ROCKET_SMOKE_PUFF_SIZE_MAX = 0.92;
const ROCKET_SMOKE_HOT_SIZE_MIN = 0.1;
const ROCKET_SMOKE_HOT_SIZE_MAX = 0.28;
const ROCKET_SMOKE_PUFF_GROW_SPEED = 1.65;
const ROCKET_SMOKE_RISE_M = 1.75;
const ROCKET_SMOKE_WOBBLE_M = 0.42;

const _direction = new Vector3();
const _dummy = new Object3D();

interface ActiveSmokePuff {
  slot: number;
  spawnedAtMs: number;
  x: number;
  y: number;
  z: number;
  scaleXMul: number;
  scaleYMul: number;
  roll: number;
  wobbleX: number;
  wobbleZ: number;
  heat: number;
  lifetimeMs: number;
  sizeMin: number;
  sizeMax: number;
}

let unitSmokeGeometry: PlaneGeometry | null = null;

function getUnitSmokeGeometry(): PlaneGeometry {
  if (unitSmokeGeometry === null) {
    unitSmokeGeometry = new PlaneGeometry(1, 1);
  }
  return unitSmokeGeometry;
}

function puffSeed(spawnedAtMs: number, slot: number, salt: number): number {
  const n = Math.sin(spawnedAtMs * 0.017 + slot * 12.9898 + salt * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function puffLifetimeAlpha(progress: number): number {
  if (progress < 0.08) {
    return progress / 0.08;
  }

  const fade = (progress - 0.08) / 0.92;
  const eased = 1 - fade;
  return eased * eased;
}


export class RocketSmokeTrailInstancingService {
  readonly #scene: Scene;
  readonly #camera: PerspectiveCamera;
  readonly #mesh: InstancedMesh;
  readonly #lifetimeData: Float32Array;
  readonly #heatData: Float32Array;
  readonly #freeSlots: number[] = [];
  readonly #inUse = new Uint8Array(ROCKET_SMOKE_PUFFS_MAX);
  readonly #active: ActiveSmokePuff[] = [];
  #maxSlotUsed = -1;

  constructor(scene: Scene, camera: PerspectiveCamera) {
    this.#scene = scene;
    this.#camera = camera;
    this.#lifetimeData = new Float32Array(ROCKET_SMOKE_PUFFS_MAX);
    this.#heatData = new Float32Array(ROCKET_SMOKE_PUFFS_MAX);
    this.#mesh = new InstancedMesh(
      getUnitSmokeGeometry(),
      rocketSmokeTrailMaterial(this.#lifetimeData, this.#heatData),
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
      this.#heatData[slot] = 0;
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

    this.#emitPuff(
      x - _direction.x * ROCKET_SMOKE_TRAIL_OFFSET_HOT_M,
      y - _direction.y * ROCKET_SMOKE_TRAIL_OFFSET_HOT_M,
      z - _direction.z * ROCKET_SMOKE_TRAIL_OFFSET_HOT_M,
      spawnedAtMs,
      true
    );
    this.#emitPuff(
      x - _direction.x * ROCKET_SMOKE_TRAIL_OFFSET_COOL_M,
      y - _direction.y * ROCKET_SMOKE_TRAIL_OFFSET_COOL_M,
      z - _direction.z * ROCKET_SMOKE_TRAIL_OFFSET_COOL_M,
      spawnedAtMs,
      false
    );
  }

  #emitPuff(
    x: number,
    y: number,
    z: number,
    spawnedAtMs: number,
    hot: boolean
  ): void {
    const slot = this.#acquireSlot();
    if (slot === undefined) {
      return;
    }

    const seedA = puffSeed(spawnedAtMs, slot, hot ? 0.11 : 0.73);
    const seedB = puffSeed(spawnedAtMs, slot, hot ? 0.29 : 0.91);
    const seedC = puffSeed(spawnedAtMs, slot, hot ? 0.47 : 1.07);
    const seedD = puffSeed(spawnedAtMs, slot, hot ? 0.61 : 1.31);
    const seedE = puffSeed(spawnedAtMs, slot, hot ? 0.83 : 1.57);

    this.#inUse[slot] = 1;
    this.#maxSlotUsed = Math.max(this.#maxSlotUsed, slot);
    const puff: ActiveSmokePuff = {
      slot,
      spawnedAtMs,
      x,
      y,
      z,
      scaleXMul: hot ? 0.92 + seedA * 0.18 : 1.08 + seedA * 0.42,
      scaleYMul: hot ? 0.88 + seedB * 0.14 : 0.62 + seedB * 0.22,
      roll: seedC * Math.PI * 2,
      wobbleX: (seedD - 0.5) * ROCKET_SMOKE_WOBBLE_M,
      wobbleZ: (seedE - 0.5) * ROCKET_SMOKE_WOBBLE_M,
      heat: hot ? 0.82 + seedA * 0.18 : 0.12 + seedB * 0.28,
      lifetimeMs: hot ? ROCKET_SMOKE_PUFF_LIFETIME_MS * 0.42 : ROCKET_SMOKE_PUFF_LIFETIME_MS,
      sizeMin: hot ? ROCKET_SMOKE_HOT_SIZE_MIN : ROCKET_SMOKE_PUFF_SIZE_MIN,
      sizeMax: hot ? ROCKET_SMOKE_HOT_SIZE_MAX : ROCKET_SMOKE_PUFF_SIZE_MAX
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
      if (elapsed >= puff.lifetimeMs) {
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
    const elapsed = nowMs - puff.spawnedAtMs;
    const progress = Math.min(1, elapsed / puff.lifetimeMs);
    const grow = Math.min(1, progress * ROCKET_SMOKE_PUFF_GROW_SPEED);
    const size = puff.sizeMin + (puff.sizeMax - puff.sizeMin) * grow;
    const lifetimeLeft = puffLifetimeAlpha(progress);
    const rise = progress * ROCKET_SMOKE_RISE_M;
    const wobble = progress;

    _dummy.position.set(
      puff.x + puff.wobbleX * wobble,
      puff.y + rise,
      puff.z + puff.wobbleZ * wobble
    );
    _dummy.scale.set(size * puff.scaleXMul, size * puff.scaleYMul, 1);
    _dummy.lookAt(this.#camera.position);
    _dummy.rotateZ(puff.roll);
    _dummy.updateMatrix();
    this.#mesh.setMatrixAt(puff.slot, _dummy.matrix);
    this.#lifetimeData[puff.slot] = lifetimeLeft;
    this.#heatData[puff.slot] = puff.heat;
    this.#mesh.count = this.#maxSlotUsed + 1;
  }

  #releaseSlot(slot: number): void {
    if (this.#inUse[slot] === 0) {
      return;
    }

    this.#mesh.setMatrixAt(slot, hiddenInstanceMatrix());
    this.#lifetimeData[slot] = 0;
    this.#heatData[slot] = 0;
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
