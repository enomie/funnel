import {
  BoxGeometry,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Scene,
  Vector3
} from 'three/webgpu';
import {
  boltProjectileDimensions
} from '../combat/projectile-visuals';
import type { ProjectileVisualKind } from '../combat/weapon-definitions';
import { projectileCoreMaterial } from '../combat/projectile-materials';
import { hiddenInstanceMatrix } from './instance-hidden-matrix';

const BOLTS_PER_COLOR = 128;

const _axis = new Vector3(0, 1, 0);
const _direction = new Vector3();
const _orientation = new Quaternion();
const _rollQuat = new Quaternion();
const _position = new Vector3();
const _scale = new Vector3(1, 1, 1);
const _matrix = new Matrix4();

let unitBoltGeometry: BoxGeometry | null = null;

interface InstancedBoltLayer {
  readonly mesh: InstancedMesh;
  readonly freeSlots: number[];
  readonly inUse: Uint8Array;
  maxSlotUsed: number;
}

export interface InstancedBoltVisual {
  readonly color: number;
  readonly kind: ProjectileVisualKind;
  slot: number;
}

function getUnitBoltGeometry(): BoxGeometry {
  if (unitBoltGeometry === null) {
    unitBoltGeometry = new BoxGeometry(1, 1, 1);
  }
  return unitBoltGeometry;
}

/** Instanced elongated boxes for Sniper / Shock LMB bolts — one draw call per weapon color. */
export class BoltInstancingService {
  readonly #scene: Scene;
  readonly #layers = new Map<number, InstancedBoltLayer>();

  constructor(scene: Scene) {
    this.#scene = scene;
  }

  acquireBolt(color: number, kind: ProjectileVisualKind): InstancedBoltVisual | null {
    const slot = this.#acquireSlot(color);
    if (slot < 0) {
      return null;
    }
    return { color, kind, slot };
  }

  releaseBolt(visual: InstancedBoltVisual): void {
    this.#releaseSlot(visual.color, visual.slot);
  }

  syncBolt(
    visual: InstancedBoltVisual,
    x: number,
    y: number,
    z: number,
    dirX: number,
    dirY: number,
    dirZ: number,
    visualScale = 1,
    rollRadians = 0
  ): void {
    const layer = this.#layers.get(visual.color);
    if (layer === undefined) {
      return;
    }

    _direction.set(dirX, dirY, dirZ);
    if (_direction.lengthSq() <= 0.0001) {
      _direction.set(0, 0, 1);
    } else {
      _direction.normalize();
    }

    const dims = boltProjectileDimensions(visual.kind);
    const crossSection = dims.crossSectionM * visualScale;
    const length = dims.lengthM * visualScale;
    _position.set(x, y, z);
    _orientation.setFromUnitVectors(_axis, _direction);
    if (rollRadians !== 0) {
      _orientation.multiply(_rollQuat.setFromAxisAngle(_axis, rollRadians));
    }
    _matrix.compose(
      _position,
      _orientation,
      _scale.set(crossSection, length, crossSection)
    );
    layer.mesh.setMatrixAt(visual.slot, _matrix);
    layer.mesh.instanceMatrix.needsUpdate = true;
    layer.maxSlotUsed = Math.max(layer.maxSlotUsed, visual.slot);
    layer.mesh.count = layer.maxSlotUsed + 1;
  }

  #acquireSlot(color: number): number {
    const layer = this.#ensureLayer(color);
    const slot = layer.freeSlots.pop();
    if (slot === undefined) {
      return -1;
    }

    layer.inUse[slot] = 1;
    layer.maxSlotUsed = Math.max(layer.maxSlotUsed, slot);
    return slot;
  }

  #releaseSlot(color: number, slot: number): void {
    const layer = this.#layers.get(color);
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

  #ensureLayer(color: number): InstancedBoltLayer {
    const existing = this.#layers.get(color);
    if (existing !== undefined) {
      return existing;
    }

    const mesh = new InstancedMesh(
      getUnitBoltGeometry(),
      projectileCoreMaterial(color),
      BOLTS_PER_COLOR
    );
    mesh.name = `instanced-bolt-${color.toString(16)}`;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = 10;
    mesh.count = 0;

    const freeSlots: number[] = [];
    const inUse = new Uint8Array(BOLTS_PER_COLOR);
    for (let slot = BOLTS_PER_COLOR - 1; slot >= 0; slot -= 1) {
      freeSlots.push(slot);
      mesh.setMatrixAt(slot, hiddenInstanceMatrix());
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.#scene.add(mesh);

    const layer: InstancedBoltLayer = { mesh, freeSlots, inUse, maxSlotUsed: -1 };
    this.#layers.set(color, layer);
    return layer;
  }
}
