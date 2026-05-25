import type { RigidBody } from '@dimforge/rapier3d-simd-compat';
import {
  InstancedMesh,
  Matrix4,
  Quaternion,
  Scene,
  Vector3,
  type BufferGeometry
} from 'three/webgpu';
import { ENVIRONMENT_CONFIG } from '../config/game-config';
import {
  createDynamicPropGeometry,
  dynamicPropKey,
  type DynamicPropSpec
} from './environment-dynamic-shapes';
import { RAIN_WAVE_CATALOG } from './environment-rain-catalog';
import { dynamicGridMaterial } from '../render/materials/environment-dynamic-style';

function configuredRainCapacity(shape: DynamicPropSpec, docDefault: number): number {
  const key = dynamicPropKey(shape);
  for (const wave of RAIN_WAVE_CATALOG) {
    if (dynamicPropKey(wave.shape) === key) {
      return Math.max(docDefault, ENVIRONMENT_CONFIG.rainCounts[wave.id]);
    }
  }
  return docDefault;
}

/** Max per shape class — sized for configured rain counts (docs/environment-dynamic.md). */
const DYNAMIC_ENVIRONMENT_POOLS = [
  {
    key: 'box-2x2x20',
    shape: { kind: 'box', size: [2, 2, 20] },
    capacity: configuredRainCapacity({ kind: 'box', size: [2, 2, 20] }, 30)
  },
  {
    key: 'box-2x2x2',
    shape: { kind: 'box', size: [2, 2, 2] },
    capacity: configuredRainCapacity({ kind: 'box', size: [2, 2, 2] }, 20)
  },
  {
    key: 'box-3x3x3',
    shape: { kind: 'box', size: [3, 3, 3] },
    capacity: configuredRainCapacity({ kind: 'box', size: [3, 3, 3] }, 10)
  },
  {
    key: 'box-5x5x5',
    shape: { kind: 'box', size: [5, 5, 5] },
    capacity: configuredRainCapacity({ kind: 'box', size: [5, 5, 5] }, 5)
  },
  {
    key: 'box-1x1x5',
    shape: { kind: 'box', size: [1, 1, 5] },
    capacity: configuredRainCapacity({ kind: 'box', size: [1, 1, 5] }, 10)
  },
  {
    key: 'box-2x2x10',
    shape: { kind: 'box', size: [2, 2, 10] },
    capacity: configuredRainCapacity({ kind: 'box', size: [2, 2, 10] }, 10)
  },
  {
    key: 'box-20x5x1',
    shape: { kind: 'box', size: [20, 5, 1] },
    capacity: configuredRainCapacity({ kind: 'box', size: [20, 5, 1] }, 10)
  },
  {
    key: 'ramp-5x5x10',
    shape: { kind: 'ramp', width: 5, height: 5, depth: 10 },
    capacity: configuredRainCapacity({ kind: 'ramp', width: 5, height: 5, depth: 10 }, 10)
  }
] as const satisfies readonly { key: string; shape: DynamicPropSpec; capacity: number }[];

type DynamicPoolSpec = (typeof DYNAMIC_ENVIRONMENT_POOLS)[number];

export type { DynamicBoxSize, DynamicPropSpec } from './environment-dynamic-shapes';

export interface DynamicSyncedBody {
  readonly body: RigidBody;
  readonly poolKey: string;
  readonly slotIndex: number;
}

interface ShapePool {
  readonly key: string;
  readonly shape: DynamicPropSpec;
  readonly mesh: InstancedMesh;
  readonly freeSlots: number[];
  readonly bodyBySlot: (RigidBody | undefined)[];
  activeCount: number;
}

const GEOMETRY_CACHE = new Map<string, BufferGeometry>();

function getPropGeometry(spec: DynamicPropSpec): BufferGeometry {
  const key = dynamicPropKey(spec);
  const cached = GEOMETRY_CACHE.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const geometry = createDynamicPropGeometry(spec);
  GEOMETRY_CACHE.set(key, geometry);
  return geometry;
}

function createShapePool(
  scene: Scene,
  key: string,
  shape: DynamicPropSpec,
  capacity: number
): ShapePool {
  const mesh = new InstancedMesh(getPropGeometry(shape), dynamicGridMaterial(), capacity);
  mesh.name = `dynamic-environment-${key}`;
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.count = 0;
  scene.add(mesh);

  const freeSlots: number[] = [];
  for (let slot = capacity - 1; slot >= 0; slot -= 1) {
    freeSlots.push(slot);
  }

  return {
    key,
    shape,
    mesh,
    freeSlots,
    bodyBySlot: new Array<RigidBody | undefined>(capacity),
    activeCount: 0
  };
}

export class DynamicEnvironmentInstances {
  readonly #scene: Scene;
  readonly #poolSpecs = new Map<string, DynamicPoolSpec>(
    DYNAMIC_ENVIRONMENT_POOLS.map((spec) => [spec.key, spec])
  );
  readonly #pools = new Map<string, ShapePool>();
  readonly #entries: DynamicSyncedBody[] = [];
  readonly #composePosition = new Vector3();
  readonly #composeQuaternion = new Quaternion();
  readonly #composeScale = new Vector3(1, 1, 1);
  readonly #composeMatrix = new Matrix4();

  constructor(scene: Scene) {
    this.#scene = scene;
  }

  readonly entries = (): readonly DynamicSyncedBody[] => this.#entries;

  poolKeys(): readonly string[] {
    return DYNAMIC_ENVIRONMENT_POOLS.map((spec) => spec.key);
  }

  resolvePool(shape: DynamicPropSpec): ShapePool {
    const key = dynamicPropKey(shape);
    const cached = this.#pools.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const spec = this.#poolSpecs.get(key);
    if (spec === undefined) {
      throw new Error(`FUNNEL dynamic pool missing for shape ${key}.`);
    }

    const pool = createShapePool(this.#scene, spec.key, spec.shape, spec.capacity);
    this.#pools.set(key, pool);
    return pool;
  }

  /** Reserve an instance slot for a Rapier body already created by the caller. */
  attachBody(shape: DynamicPropSpec, body: RigidBody): DynamicSyncedBody {
    const pool = this.resolvePool(shape);
    const slotIndex = pool.freeSlots.pop();
    if (slotIndex === undefined) {
      throw new Error(`FUNNEL dynamic pool exhausted: ${pool.key}.`);
    }

    pool.bodyBySlot[slotIndex] = body;
    pool.activeCount = Math.max(pool.activeCount, slotIndex + 1);
    pool.mesh.count = pool.activeCount;

    const entry: DynamicSyncedBody = {
      body,
      poolKey: pool.key,
      slotIndex
    };
    this.#entries.push(entry);
    this.#writeBodyMatrix(pool, slotIndex, body);
    pool.mesh.instanceMatrix.needsUpdate = true;
    return entry;
  }

  sync(): void {
    if (this.#entries.length === 0) {
      return;
    }

    for (const pool of this.#pools.values()) {
      if (pool.activeCount === 0) {
        continue;
      }

      let poolDirty = false;
      for (let slotIndex = 0; slotIndex < pool.activeCount; slotIndex += 1) {
        const body = pool.bodyBySlot[slotIndex];
        if (body === undefined) {
          continue;
        }
        if (body.isSleeping()) {
          continue;
        }
        this.#writeBodyMatrix(pool, slotIndex, body);
        poolDirty = true;
      }

      if (poolDirty) {
        pool.mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }

  #writeBodyMatrix(pool: ShapePool, slotIndex: number, body: RigidBody): void {
    const translation = body.translation();
    const rotation = body.rotation();
    this.#composePosition.set(translation.x, translation.y, translation.z);
    this.#composeQuaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    this.#composeMatrix.compose(this.#composePosition, this.#composeQuaternion, this.#composeScale);
    pool.mesh.setMatrixAt(slotIndex, this.#composeMatrix);
  }
}
