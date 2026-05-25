// Path: /Users/johann/MyBrew/funnel-real/src/player/collada-animation-remap.ts

import { Bone, type AnimationClip, type Object3D } from 'three/webgpu';


export function remapAnimationClipToBoneNames(clip: AnimationClip, sourceScene: Object3D): AnimationClip {
  const uuidToBoneName = new Map<string, string>();
  sourceScene.traverse((object) => {
    if (object instanceof Bone) {
      uuidToBoneName.set(object.uuid, object.name);
    }
  });

  const remapped = clip.clone();
  for (const track of remapped.tracks) {
    const dot = track.name.lastIndexOf('.');
    const nodeUuid = dot === -1 ? track.name : track.name.slice(0, dot);
    const propertySuffix = dot === -1 ? '' : track.name.slice(dot);
    const boneName = uuidToBoneName.get(nodeUuid);
    if (boneName !== undefined) {
      track.name = `${boneName}${propertySuffix}`;
    }
  }

  return remapped;
}
