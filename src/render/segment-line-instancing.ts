import {
  BoxGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Scene,
  Vector3
} from 'three/webgpu';

import { hiddenInstanceMatrix } from './instance-hidden-matrix';

const SEGMENTS_PER_COLOR = 128;
const LINE_THICKNESS = 0.02;
const LINE_OPACITY = 0.93;

const _axis = new Vector3(0, 1, 0);
const _direction = new Vector3();
const _midpoint = new Vector3();
const _orientation = new Quaternion();
const _scale = new Vector3(1, 1, 1);
const _matrix = new Matrix4();

let unitSegmentGeometry: BoxGeometry | null = null;

const LINE_MATERIAL_CACHE = new Map<number, MeshBasicMaterial>();

interface InstancedLineLayer {
  readonly mesh: InstancedMesh;
  readonly freeSlots: number[];
  readonly inUse: Uint8Array;
  maxSlotUsed: number;
}

interface ActiveSegment {
  readonly layerKey: string;
  readonly slot: number;
  readonly removeAtMs: number;
}

function getUnitSegmentGeometry(): BoxGeometry {
  if (unitSegmentGeometry === null) {
    unitSegmentGeometry = new BoxGeometry(1, 1, 1);
  }
  return unitSegmentGeometry;
}

function lineMaterialForColor(color: number): MeshBasicMaterial {
  const cached = LINE_MATERIAL_CACHE.get(color);
  if (cached !== undefined) {
    return cached;
  }

  const material = new MeshBasicMaterial({
    color,
    transparent: true,
    opacity: LINE_OPACITY,
    depthWrite: false
  });
  LINE_MATERIAL_CACHE.set(color, material);
  return material;
}

/** Instanced thin boxes for projectile trails and hitscan tracers — one draw call per weapon color. */
export class SegmentLineInstancingService {
  readonly #scene: Scene;
  readonly #layers = new Map<string, InstancedLineLayer>();
  readonly #active: ActiveSegment[] = [];

  constructor(scene: Scene) {
    this.#scene = scene;
  }

  spawnSegment(start: Vector3, end: Vector3, color: number, durationMs: number): void {
    const layerKey = `line:${String(color)}`;
    const slot = this.#acquireSlot(layerKey, color);
    if (slot < 0) {
      return;
    }

    this.#setSegmentMatrix(layerKey, slot, start, end);
    this.#active.push({
      layerKey,
      slot,
      removeAtMs: performance.now() + durationMs
    });
  }

  tick(nowMs: number): void {
    for (let index = this.#active.length - 1; index >= 0; index -= 1) {
      const segment = this.#active[index];
      if (segment.removeAtMs > nowMs) {
        continue;
      }

      this.#releaseSlot(segment.layerKey, segment.slot);
      this.#active[index] = this.#active[this.#active.length - 1];
      this.#active.length -= 1;
    }
  }

  hasActive(): boolean {
    return this.#active.length > 0;
  }

  clearAll(): void {
    for (const segment of this.#active) {
      this.#releaseSlot(segment.layerKey, segment.slot);
    }
    this.#active.length = 0;
  }

  #acquireSlot(layerKey: string, color: number): number {
    const layer = this.#ensureLayer(layerKey, color);
    const slot = layer.freeSlots.pop();
    if (slot === undefined) {
      return -1;
    }

    layer.inUse[slot] = 1;
    layer.maxSlotUsed = Math.max(layer.maxSlotUsed, slot);
    return slot;
  }

  #releaseSlot(layerKey: string, slot: number): void {
    const layer = this.#layers.get(layerKey);
    if (layer === undefined || layer.inUse[slot] === 0) {
      return;
    }

    layer.mesh.setMatrixAt(slot, hiddenInstanceMatrix());
    layer.mesh.instanceMatrix.needsUpdate = true;
    layer.inUse[slot] = 0;
    layer.freeSlots.push(slot);
    if (slot === layer.maxSlotUsed) {
      while (layer.maxSlotUsed >= 0 && layer.inUse[layer.maxSlotUsed] === 0) {
        layer.maxSlotUsed -= 1;
      }
    }
    layer.mesh.count = layer.maxSlotUsed >= 0 ? layer.maxSlotUsed + 1 : 0;
  }

  #ensureLayer(layerKey: string, color: number): InstancedLineLayer {
    const existing = this.#layers.get(layerKey);
    if (existing !== undefined) {
      return existing;
    }

    const mesh = new InstancedMesh(getUnitSegmentGeometry(), lineMaterialForColor(color), SEGMENTS_PER_COLOR);
    mesh.name = `instanced-line-${layerKey}`;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = 9;
    mesh.count = 0;

    const freeSlots: number[] = [];
    const inUse = new Uint8Array(SEGMENTS_PER_COLOR);
    for (let slot = SEGMENTS_PER_COLOR - 1; slot >= 0; slot -= 1) {
      freeSlots.push(slot);
      mesh.setMatrixAt(slot, hiddenInstanceMatrix());
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.#scene.add(mesh);

    const layer: InstancedLineLayer = { mesh, freeSlots, inUse, maxSlotUsed: -1 };
    this.#layers.set(layerKey, layer);
    return layer;
  }

  #setSegmentMatrix(layerKey: string, slot: number, start: Vector3, end: Vector3): void {
    const layer = this.#layers.get(layerKey);
    if (layer === undefined) {
      return;
    }

    _direction.subVectors(end, start);
    const length = _direction.length();
    if (length <= 0.001) {
      layer.mesh.setMatrixAt(slot, hiddenInstanceMatrix());
      layer.mesh.instanceMatrix.needsUpdate = true;
      return;
    }

    _direction.multiplyScalar(1 / length);
    _midpoint.copy(start).add(end).multiplyScalar(0.5);
    _orientation.setFromUnitVectors(_axis, _direction);
    _matrix.compose(
      _midpoint,
      _orientation,
      _scale.set(LINE_THICKNESS, length, LINE_THICKNESS)
    );
    layer.mesh.setMatrixAt(slot, _matrix);
    layer.mesh.instanceMatrix.needsUpdate = true;
    layer.maxSlotUsed = Math.max(layer.maxSlotUsed, slot);
    layer.mesh.count = layer.maxSlotUsed + 1;
  }
}
