// Path: /Users/johann/MyBrew/funnel-real/src/player/player-aim-spine.ts

import { Bone, SkinnedMesh, type Object3D } from 'three/webgpu';


const AIM_PITCH_SIGN = -1;


const SPINE_AIM_WEIGHTS: ReadonlyArray<{ name: string; weight: number }> = [
  { name: 'mixamorig_Spine', weight: 0.22 },
  { name: 'mixamorig_Spine1', weight: 0.38 },
  { name: 'mixamorig_Spine2', weight: 0.28 },
  { name: 'mixamorig_Neck', weight: 0.12 }
];

const WEAPON_SOCKET_PITCH_FACTOR = 0.82;

export class PlayerAimSpine {
  readonly #bones: Array<{ bone: Object3D; weight: number }> = [];
  #skinnedMeshes: Object3D[] = [];
  #characterRoot: Object3D | null = null;

  bind(characterRoot: Object3D): void {
    this.#characterRoot = characterRoot;
    this.#bones.length = 0;
    this.#skinnedMeshes = [];

    const boneByName = new Map<string, Object3D>();
    characterRoot.traverse((object: Object3D) => {
      if (object instanceof Bone) {
        boneByName.set(object.name, object);
      }
      if (object instanceof SkinnedMesh) {
        this.#skinnedMeshes.push(object);
      }
    });

    for (const { name, weight } of SPINE_AIM_WEIGHTS) {
      const bone = boneByName.get(name);
      if (bone !== undefined) {
        this.#bones.push({ bone, weight });
      }
    }
  }

  
  apply(pitch: number, thirdPersonBlend: number, weaponSocket: Object3D): void {
    if (this.#bones.length === 0 || thirdPersonBlend <= 0.01) {
      weaponSocket.rotation.x = 0;
      return;
    }

    const aim = pitch * thirdPersonBlend;
    for (const { bone, weight } of this.#bones) {
      bone.rotation.x += AIM_PITCH_SIGN * aim * weight;
    }

    weaponSocket.rotation.x = AIM_PITCH_SIGN * aim * WEAPON_SOCKET_PITCH_FACTOR;

    for (const mesh of this.#skinnedMeshes) {
      if (mesh instanceof SkinnedMesh) {
        mesh.skeleton.update();
      }
    }
    this.#characterRoot?.updateMatrixWorld(true);
  }
}
