import {
  CapsuleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Scene,
  type BufferGeometry
} from 'three/webgpu';
import type { Collider } from '@dimforge/rapier3d-simd-compat';
import { DEBUG_CONFIG } from '../config/game-config';

const WIRE_COLOR = 0x44ffaa;
const CAP_SEGMENTS = 4;
const RADIAL_SEGMENTS = 8;

function disposeGeometry(geometry: BufferGeometry): void {
  geometry.dispose();
}

/** Wireframe mirror of the Rapier capsule — world-aligned, no visual yaw. */
export class HumanoidCapsuleDebugView {
  readonly root = new Group();
  readonly #mesh: Mesh;
  #cachedHalfHeight = Number.NaN;
  #cachedRadius = Number.NaN;

  constructor() {
    this.#mesh = new Mesh(
      new CapsuleGeometry(0.35, 1.05, CAP_SEGMENTS, RADIAL_SEGMENTS),
      new MeshBasicMaterial({ color: WIRE_COLOR, wireframe: true })
    );
    this.root.add(this.#mesh);
    this.root.visible = false;
  }

  mount(scene: Scene): void {
    scene.add(this.root);
  }

  sync(collider: Collider): void {
    if (!DEBUG_CONFIG.showCapsuleColliders) {
      this.root.visible = false;
      return;
    }

    const halfHeight = collider.halfHeight();
    const radius = collider.radius();
    const translation = collider.translation();

    this.root.visible = true;
    this.root.position.set(translation.x, translation.y, translation.z);
    this.root.rotation.set(0, 0, 0);

    if (halfHeight !== this.#cachedHalfHeight || radius !== this.#cachedRadius) {
      const previous = this.#mesh.geometry;
      this.#mesh.geometry = new CapsuleGeometry(
        radius,
        halfHeight * 2,
        CAP_SEGMENTS,
        RADIAL_SEGMENTS
      );
      disposeGeometry(previous);
      this.#cachedHalfHeight = halfHeight;
      this.#cachedRadius = radius;
    }
  }

  dispose(scene: Scene): void {
    scene.remove(this.root);
    disposeGeometry(this.#mesh.geometry);
    (this.#mesh.material as MeshBasicMaterial).dispose();
  }
}

export class CapsuleColliderDebugLayer {
  readonly #scene: Scene;
  readonly #views = new Map<string, HumanoidCapsuleDebugView>();

  constructor(scene: Scene) {
    this.#scene = scene;
  }

  sync(id: string, collider: Collider): void {
    let view = this.#views.get(id);
    if (view === undefined) {
      view = new HumanoidCapsuleDebugView();
      view.mount(this.#scene);
      this.#views.set(id, view);
    }

    view.sync(collider);
  }

  untrack(id: string): void {
    const view = this.#views.get(id);
    if (view === undefined) {
      return;
    }

    view.dispose(this.#scene);
    this.#views.delete(id);
  }

  dispose(): void {
    for (const id of [...this.#views.keys()]) {
      this.untrack(id);
    }
  }
}
