import {
  InstancedMesh,
  Matrix4,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3
} from 'three/webgpu';
import { hiddenInstanceMatrix } from './instance-hidden-matrix';
import { rocketSmokeTrailMaterial } from './materials/rocket-smoke-trail-tsl';

export const ROCKET_SMOKE_SPAWN_INTERVAL_MS = 22;
export const ROCKET_SMOKE_PUFF_LIFETIME_MS = 720;
export const ROCKET_SMOKE_PUFFS_MAX = 128;
const ROCKET_SMOKE_TRAIL_OFFSET_M = 0.18;
const ROCKET_SMOKE_LATERAL_SPREAD_M = 0.13;
const ROCKET_SMOKE_RIM_JITTER_M = 0.07;
const ROCKET_SMOKE_EDGE_SCALE = 0.74;
const ROCKET_SMOKE_EXTRA_RIM_CHANCE = 0.42;
const ROCKET_SMOKE_EXTRA_RIM_SCALE = 0.62;
const ROCKET_SMOKE_PUFF_START_SCALE = 0.09;
const ROCKET_SMOKE_PUFF_PEAK_SCALE = 0.34;
const ROCKET_SMOKE_PUFF_END_SCALE = 0.42;
const ROCKET_SMOKE_RISE_M = 0.1;
const ROCKET_SMOKE_CROSS_WIDTH = 0.52;
const ROCKET_SMOKE_TRAIL_STRETCH_MIN = 0.55;
const ROCKET_SMOKE_TRAIL_STRETCH_MAX = 2.35;

const _direction = new Vector3();
const _scale = new Vector3(1, 1, 1);
const _syncMatrix = new Matrix4();
const _billboard = new Object3D();
const _toCamera = new Vector3();
const _projectedFlight = new Vector3();
const _localX = new Vector3();
const _localY = new Vector3();
const _worldUp = new Vector3(0, 1, 0);
const _worldFallback = new Vector3(1, 0, 0);
const _side = new Vector3();
const _binormal = new Vector3();
const _offset = new Vector3();

interface ActiveSmokePuff {
  slot: number;
  spawnedAtMs: number;
  x: number;
  y: number;
  z: number;
  dirX: number;
  dirY: number;
  dirZ: number;
  scaleMul: number;
}

let unitSmokeGeometry: PlaneGeometry | null = null;

function getUnitSmokeGeometry(): PlaneGeometry {
  if (unitSmokeGeometry === null) {
    unitSmokeGeometry = new PlaneGeometry(1, 1);
  }
  return unitSmokeGeometry;
}

function rollBillboardToFlight(
  billboard: Object3D,
  dirX: number,
  dirY: number,
  dirZ: number,
  cameraPosition: Vector3
): void {
  _toCamera.subVectors(cameraPosition, billboard.position);
  if (_toCamera.lengthSq() <= 0.0001) {
    return;
  }
  _toCamera.normalize();

  _projectedFlight.set(dirX, dirY, dirZ).addScaledVector(_toCamera, -(_projectedFlight.dot(_toCamera)));
  if (_projectedFlight.lengthSq() <= 0.0001) {
    return;
  }
  _projectedFlight.normalize();

  _localY.set(0, 1, 0).applyQuaternion(billboard.quaternion);
  _localX.set(1, 0, 0).applyQuaternion(billboard.quaternion);
  billboard.rotateZ(
    Math.atan2(_localX.dot(_projectedFlight), _localY.dot(_projectedFlight))
  );
}

function buildTrailLateralFrame(dirX: number, dirY: number, dirZ: number): void {
  _direction.set(dirX, dirY, dirZ);
  _side.crossVectors(_direction, _worldUp);
  if (_side.lengthSq() <= 0.0001) {
    _side.crossVectors(_direction, _worldFallback);
  }
  _side.normalize();
  _binormal.crossVectors(_direction, _side).normalize();
}

/** Pooled instanced smoke puffs for rocket trails — TSL billboards, capped at 96. */
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
    spawnedAtMs = performance.now()
  ): void {
    _direction.set(dirX, dirY, dirZ);
    if (_direction.lengthSq() <= 0.0001) {
      _direction.set(0, 0, 1);
    } else {
      _direction.normalize();
    }

    buildTrailLateralFrame(_direction.x, _direction.y, _direction.z);

    const baseX = x - _direction.x * ROCKET_SMOKE_TRAIL_OFFSET_M;
    const baseY = y - _direction.y * ROCKET_SMOKE_TRAIL_OFFSET_M;
    const baseZ = z - _direction.z * ROCKET_SMOKE_TRAIL_OFFSET_M;
    const dirNormX = _direction.x;
    const dirNormY = _direction.y;
    const dirNormZ = _direction.z;

    this.#emitPuffAt(baseX, baseY, baseZ, dirNormX, dirNormY, dirNormZ, 1, spawnedAtMs);

    for (const sign of [-1, 1] as const) {
      const sideOff = sign * ROCKET_SMOKE_LATERAL_SPREAD_M * (0.84 + Math.random() * 0.32);
      const binOff = (Math.random() - 0.5) * ROCKET_SMOKE_RIM_JITTER_M;
      const upOff = (Math.random() - 0.5) * ROCKET_SMOKE_RIM_JITTER_M * 0.55;
      _offset
        .copy(_side)
        .multiplyScalar(sideOff)
        .addScaledVector(_binormal, binOff)
        .addScaledVector(_worldUp, upOff);
      this.#emitPuffAt(
        baseX + _offset.x,
        baseY + _offset.y,
        baseZ + _offset.z,
        dirNormX,
        dirNormY,
        dirNormZ,
        ROCKET_SMOKE_EDGE_SCALE,
        spawnedAtMs
      );
    }

    if (Math.random() < ROCKET_SMOKE_EXTRA_RIM_CHANCE) {
      const rimSign = Math.random() < 0.5 ? -1 : 1;
      const sideOff = rimSign * ROCKET_SMOKE_LATERAL_SPREAD_M * (0.55 + Math.random() * 0.35);
      const binOff = rimSign * ROCKET_SMOKE_LATERAL_SPREAD_M * (0.28 + Math.random() * 0.22);
      const upOff = (Math.random() - 0.5) * ROCKET_SMOKE_RIM_JITTER_M * 0.45;
      _offset
        .copy(_side)
        .multiplyScalar(sideOff)
        .addScaledVector(_binormal, binOff)
        .addScaledVector(_worldUp, upOff);
      this.#emitPuffAt(
        baseX + _offset.x,
        baseY + _offset.y,
        baseZ + _offset.z,
        dirNormX,
        dirNormY,
        dirNormZ,
        ROCKET_SMOKE_EXTRA_RIM_SCALE,
        spawnedAtMs
      );
    }

    this.#mesh.instanceMatrix.needsUpdate = true;
  }

  #emitPuffAt(
    x: number,
    y: number,
    z: number,
    dirX: number,
    dirY: number,
    dirZ: number,
    scaleMul: number,
    spawnedAtMs: number
  ): void {
    const slot = this.#acquireSlot();
    if (slot === undefined) {
      return;
    }

    this.#inUse[slot] = 1;
    this.#maxSlotUsed = Math.max(this.#maxSlotUsed, slot);
    const puff: ActiveSmokePuff = {
      slot,
      spawnedAtMs,
      x,
      y,
      z,
      dirX,
      dirY,
      dirZ,
      scaleMul
    };
    this.#active.push(puff);
    this.#syncPuffSlot(puff, spawnedAtMs);
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
    const growPhase = Math.min(1, progress / 0.38);
    const fadePhase = Math.max(0, (progress - 0.5) / 0.5);
    const growScale =
      ROCKET_SMOKE_PUFF_START_SCALE +
      (ROCKET_SMOKE_PUFF_PEAK_SCALE - ROCKET_SMOKE_PUFF_START_SCALE) * growPhase;
    const endScale =
      ROCKET_SMOKE_PUFF_PEAK_SCALE +
      (ROCKET_SMOKE_PUFF_END_SCALE - ROCKET_SMOKE_PUFF_PEAK_SCALE) * fadePhase;
    const scale = growPhase < 1 ? growScale : endScale * (1 - fadePhase * 0.88);
    const scaled = scale * puff.scaleMul;
    const riseY = ROCKET_SMOKE_RISE_M * progress * (1 - fadePhase * 0.6);
    const lifetimeLeft = Math.max(0, 1 - progress);
    const trailStretch =
      ROCKET_SMOKE_TRAIL_STRETCH_MIN +
      (ROCKET_SMOKE_TRAIL_STRETCH_MAX - ROCKET_SMOKE_TRAIL_STRETCH_MIN) * progress;

    _billboard.position.set(puff.x, puff.y + riseY, puff.z);
    _billboard.quaternion.identity();
    _billboard.lookAt(this.#camera.position);
    rollBillboardToFlight(_billboard, puff.dirX, puff.dirY, puff.dirZ, this.#camera.position);
    _syncMatrix.compose(
      _billboard.position,
      _billboard.quaternion,
      _scale.set(
        scaled * ROCKET_SMOKE_CROSS_WIDTH,
        scaled * trailStretch,
        1
      )
    );
    this.#mesh.setMatrixAt(puff.slot, _syncMatrix);
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
