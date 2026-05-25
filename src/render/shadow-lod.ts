import { Mesh, type Object3D } from 'three/webgpu';
import { getRuntimeProfile } from '../platform/chrome-macos-arm-profile';

/** Viewer-relative shadow quality — cast/receive toggles only, no extra draw variants. */
const CAST_NEAR_M = 12;
const CAST_NEAR_EXIT_M = 14;
const RECEIVE_MID_M = 22;
const RECEIVE_MID_EXIT_M = 26;

const CAST_NEAR_SQ = CAST_NEAR_M * CAST_NEAR_M;
const CAST_NEAR_EXIT_SQ = CAST_NEAR_EXIT_M * CAST_NEAR_EXIT_M;
const RECEIVE_MID_SQ = RECEIVE_MID_M * RECEIVE_MID_M;
const RECEIVE_MID_EXIT_SQ = RECEIVE_MID_EXIT_M * RECEIVE_MID_EXIT_M;

/** Subjects processed per frame — full roster refresh in ~4 frames at 40 actors. */
const SUBJECTS_PER_FRAME = getRuntimeProfile().shadowSubjectsPerFrame;

type ShadowLodTier = 0 | 1 | 2;

interface ShadowLodSubject {
  readonly root: Object3D;
  meshes: Mesh[];
  readonly alwaysFull: boolean;
  tier: ShadowLodTier;
}

function collectShadowMeshes(root: Object3D): Mesh[] {
  const meshes: Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof Mesh) {
      meshes.push(object as Mesh);
    }
  });
  return meshes;
}

function resolveTier(
  distSq: number,
  current: ShadowLodTier,
  alwaysFull: boolean
): ShadowLodTier {
  if (alwaysFull) {
    return 0;
  }

  if (current === 0) {
    if (distSq > CAST_NEAR_EXIT_SQ) {
      return distSq > RECEIVE_MID_EXIT_SQ ? 2 : 1;
    }
    return 0;
  }

  if (current === 1) {
    if (distSq < CAST_NEAR_SQ) {
      return 0;
    }
    if (distSq > RECEIVE_MID_EXIT_SQ) {
      return 2;
    }
    return 1;
  }

  if (distSq < CAST_NEAR_SQ) {
    return 0;
  }
  if (distSq < RECEIVE_MID_SQ) {
    return 1;
  }
  return 2;
}

function applyTier(subject: ShadowLodSubject, tier: ShadowLodTier): void {
  if (subject.tier === tier) {
    return;
  }

  subject.tier = tier;
  const cast = tier === 0;
  const receive = tier <= 1;

  for (let index = 0; index < subject.meshes.length; index += 1) {
    const mesh = subject.meshes[index];
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
  }
}

export class ShadowLodController {
  readonly #subjects: ShadowLodSubject[] = [];
  #cursor = 0;
  #playerX = 0;
  #playerY = 0;
  #playerZ = 0;

  register(root: Object3D, options: { alwaysFull?: boolean } = {}): void {
    const subject: ShadowLodSubject = {
      root,
      meshes: collectShadowMeshes(root),
      alwaysFull: options.alwaysFull === true,
      tier: 2
    };
    this.#subjects.push(subject);
    this.#applySubject(subject);
  }

  unregister(root: Object3D): void {
    const index = this.#subjects.findIndex((subject) => subject.root === root);
    if (index < 0) {
      return;
    }

    const lastIndex = this.#subjects.length - 1;
    if (index !== lastIndex) {
      this.#subjects[index] = this.#subjects[lastIndex];
    }
    this.#subjects.length = lastIndex;
    if (this.#cursor >= this.#subjects.length) {
      this.#cursor = 0;
    }
  }

  /** Re-scan after weapon mesh swap on an already registered actor root. */
  refresh(root: Object3D): void {
    const subject = this.#subjects.find((entry) => entry.root === root);
    if (subject === undefined) {
      return;
    }

    subject.meshes = collectShadowMeshes(root);
    this.#applySubject(subject);
  }

  update(playerX: number, playerY: number, playerZ: number): void {
    if (!getRuntimeProfile().shadowsEnabled) {
      return;
    }

    this.#playerX = playerX;
    this.#playerY = playerY;
    this.#playerZ = playerZ;

    const count = this.#subjects.length;
    if (count === 0) {
      return;
    }

    const batch = Math.min(SUBJECTS_PER_FRAME, count);
    for (let step = 0; step < batch; step += 1) {
      const subject = this.#subjects[this.#cursor];
      this.#cursor += 1;
      if (this.#cursor >= count) {
        this.#cursor = 0;
      }
      this.#applySubject(subject);
    }
  }

  #applySubject(subject: ShadowLodSubject): void {
    if (subject.alwaysFull) {
      applyTier(subject, 0);
      return;
    }

    const root = subject.root;
    const dx = root.position.x - this.#playerX;
    const dy = root.position.y - this.#playerY;
    const dz = root.position.z - this.#playerZ;
    applyTier(subject, resolveTier(dx * dx + dy * dy + dz * dz, subject.tier, false));
  }
}
