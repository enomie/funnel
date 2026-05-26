// Path: /Users/johann/MyBrew/funnel-real/src/render/blob-shadow.ts

import {
  CircleGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  Scene,
  Vector3
} from 'three/webgpu';
import { PLAYER_CONFIG } from '../config/game-config';
import { getRuntimeProfile } from '../platform/chrome-macos-arm-profile';
import { capsuleBottomOffsetY } from '../player/player-stance';
import { hiddenInstanceMatrix } from './instance-hidden-matrix';

const BLOB_SHADOW_CAPACITY = 32;
const BLOB_VISIBLE_DIST_M = 20;
const BLOB_VISIBLE_DIST_SQ = BLOB_VISIBLE_DIST_M * BLOB_VISIBLE_DIST_M;
const BLOB_GROUND_OFFSET = capsuleBottomOffsetY(false) + 0.03;
const BLOB_RADIUS_X = PLAYER_CONFIG.radius * 1.45;
const BLOB_RADIUS_Z = PLAYER_CONFIG.radius * 1.15;
const BLOB_OPACITY = 0.36;

const _position = new Vector3();
const _scale = new Vector3();
const _quaternion = new Quaternion();
const _matrix = new Matrix4();
const _flatAxis = new Vector3(1, 0, 0);
const _flatQuat = new Quaternion().setFromAxisAngle(_flatAxis, -Math.PI * 0.5);
const _hiddenMatrix = hiddenInstanceMatrix();

const BLOB_SHADOW_GEOMETRY = new CircleGeometry(1, 12);
const BLOB_SHADOW_MATERIAL = new MeshBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: BLOB_OPACITY,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2
});

export interface BlobShadowSubjectOptions {
  readonly isVisible?: () => boolean;
}

interface BlobShadowSubject {
  readonly root: Object3D;
  readonly isVisible: () => boolean;
  slot: number;
}

export class BlobShadowController {
  readonly #mesh: InstancedMesh;
  readonly #subjects: BlobShadowSubject[] = [];
  readonly #freeSlots: number[];

  constructor(scene: Scene) {
    this.#freeSlots = [];
    for (let slot = BLOB_SHADOW_CAPACITY - 1; slot >= 0; slot -= 1) {
      this.#freeSlots.push(slot);
    }

    this.#mesh = new InstancedMesh(
      BLOB_SHADOW_GEOMETRY,
      BLOB_SHADOW_MATERIAL,
      BLOB_SHADOW_CAPACITY
    );
    this.#mesh.name = 'humanoid-blob-shadows';
    this.#mesh.frustumCulled = false;
    this.#mesh.castShadow = false;
    this.#mesh.receiveShadow = false;
    this.#mesh.renderOrder = -2;

    for (let slot = 0; slot < BLOB_SHADOW_CAPACITY; slot += 1) {
      this.#mesh.setMatrixAt(slot, _hiddenMatrix);
    }
    this.#mesh.instanceMatrix.needsUpdate = true;
    scene.add(this.#mesh);
  }

  register(root: Object3D, options: BlobShadowSubjectOptions = {}): void {
    if (this.#subjects.some((subject) => subject.root === root)) {
      return;
    }

    const slot = this.#freeSlots.pop();
    if (slot === undefined) {
      return;
    }

    this.#subjects.push({
      root,
      isVisible: options.isVisible ?? (() => true),
      slot
    });
    this.#mesh.setMatrixAt(slot, _hiddenMatrix);
    this.#mesh.instanceMatrix.needsUpdate = true;
  }

  unregister(root: Object3D): void {
    const index = this.#subjects.findIndex((subject) => subject.root === root);
    if (index < 0) {
      return;
    }

    const subject = this.#subjects[index];
    this.#freeSlots.push(subject.slot);
    this.#mesh.setMatrixAt(subject.slot, _hiddenMatrix);
    this.#mesh.instanceMatrix.needsUpdate = true;

    const lastIndex = this.#subjects.length - 1;
    if (index !== lastIndex) {
      this.#subjects[index] = this.#subjects[lastIndex];
    }
    this.#subjects.length = lastIndex;
  }

  update(playerX: number, playerY: number, playerZ: number): void {
    if (getRuntimeProfile().shadowsEnabled) {
      return;
    }

    const count = this.#subjects.length;
    if (count === 0) {
      return;
    }

    let matrixDirty = false;
    for (let index = 0; index < count; index += 1) {
      const subject = this.#subjects[index];
      const slot = subject.slot;

      if (!subject.isVisible()) {
        this.#mesh.setMatrixAt(slot, _hiddenMatrix);
        matrixDirty = true;
        continue;
      }

      const root = subject.root;
      const dx = root.position.x - playerX;
      const dy = root.position.y - playerY;
      const dz = root.position.z - playerZ;
      if (dx * dx + dy * dy + dz * dz > BLOB_VISIBLE_DIST_SQ) {
        this.#mesh.setMatrixAt(slot, _hiddenMatrix);
        matrixDirty = true;
        continue;
      }

      _matrix.compose(
        _position.set(root.position.x, root.position.y + BLOB_GROUND_OFFSET, root.position.z),
        _quaternion.copy(_flatQuat),
        _scale.set(BLOB_RADIUS_X, BLOB_RADIUS_Z, 1)
      );
      this.#mesh.setMatrixAt(slot, _matrix);
      matrixDirty = true;
    }

    if (matrixDirty) {
      this.#mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
