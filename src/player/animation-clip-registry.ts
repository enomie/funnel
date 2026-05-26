// Path: /Users/johann/MyBrew/funnel-real/src/player/animation-clip-registry.ts

import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  LoopOnce,
  SkinnedMesh,
  type Object3D
} from 'three/webgpu';

const ONE_SHOT_CLIP_IDS = new Set([
  'jump-forward',
  'jump-backward',
  'jump-up-takeoff',
  'jump-down-land',
  'start-walking',
  'stop-walking',
  'start-walking-backwards',
  'walk-backwards-stop',
  'walking-to-dying',
  'standing-up',
  'firing-rifle'
]);

export class AnimationClipRegistry {
  readonly #clips = new Map<string, AnimationClip>();
  readonly #actions = new Map<string, AnimationAction>();

  constructor(mixer: AnimationMixer) {
    this.#mixer = mixer;
  }

  readonly #mixer: AnimationMixer;

  get mixer(): AnimationMixer {
    return this.#mixer;
  }

  registerClip(clipId: string, sourceClip: AnimationClip, index = 0): void {
    const storageId = index === 0 ? clipId : `${clipId}__${String(index)}`;
    const clip = sourceClip.clone();
    clip.name = storageId;
    this.#clips.set(storageId, clip);

    const action = this.#mixer.clipAction(clip);
    if (ONE_SHOT_CLIP_IDS.has(clipId)) {
      action.setLoop(LoopOnce, 1);
      action.clampWhenFinished = true;
    }

    this.#actions.set(storageId, action);
    if (index === 0) {
      this.#actions.set(clipId, action);
    }
  }

  getAction(clipId: string): AnimationAction | undefined {
    return this.#actions.get(clipId);
  }

  getClipIds(): string[] {
    return [...this.#clips.keys()].filter((id) => !id.includes('__'));
  }

  getAllClipIds(): string[] {
    return [...this.#clips.keys()];
  }

  hasClip(clipId: string): boolean {
    return this.#clips.has(clipId);
  }

  getClip(clipId: string): AnimationClip | undefined {
    return this.#clips.get(clipId);
  }

  
  fork(mixer: AnimationMixer): AnimationClipRegistry {
    const forked = new AnimationClipRegistry(mixer);
    for (const clipId of this.getAllClipIds()) {
      const clip = this.#clips.get(clipId);
      if (clip === undefined) {
        continue;
      }

      const baseId = clipId.includes('__') ? clipId.split('__')[0] : clipId;
      const index = clipId.includes('__') ? Number(clipId.split('__')[1]) : 0;
      forked.registerClip(baseId, clip, index);
    }

    return forked;
  }
}

export function findAnimationRoot(scene: Object3D): Object3D {
  let skinnedRoot: Object3D = scene;
  scene.traverse((object) => {
    if (skinnedRoot !== scene) {
      return;
    }

    if (object instanceof SkinnedMesh) {
      skinnedRoot = object.parent ?? object;
    }
  });

  return skinnedRoot;
}
