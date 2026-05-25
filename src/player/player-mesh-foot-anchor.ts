// Path: /Users/johann/MyBrew/funnel-real/src/player/player-mesh-foot-anchor.ts

import {
  AnimationMixer,
  Bone,
  Box3,
  Group,
  type Object3D,
  Vector3
} from 'three/webgpu';
import type { AnimationClipRegistry } from './animation-clip-registry';
import { findAnimationRoot } from './animation-clip-registry';
import { characterMeshOffsetY, characterMeshOffsetYFromFootY } from './player-stance';
import {
  CROUCH_LOCOMOTION_CLIP_ID,
  STAND_LOCOMOTION_CLIP_ID,
  type StanceMeshAnchors
} from './player-stance';

const FOOT_BONES = new Set(['mixamorig_LeftFoot', 'mixamorig_RightFoot']);
const _footScratch = new Vector3();
const _meshBoundsBox = new Box3();
const _meshBoundsMin = new Vector3();


export function lowestFootYInCapsuleSpace(animRoot: Object3D, capsuleAnchor: Object3D): number {
  let minY = Infinity;
  capsuleAnchor.updateMatrixWorld(true);

  animRoot.traverse((object) => {
    if (!(object instanceof Bone) || !FOOT_BONES.has(object.name)) {
      return;
    }

    object.getWorldPosition(_footScratch);
    capsuleAnchor.worldToLocal(_footScratch);
    if (_footScratch.y < minY) {
      minY = _footScratch.y;
    }
  });

  return Number.isFinite(minY) ? minY : 0;
}


export function lowestSkinnedMeshYInCapsuleSpace(
  model: Object3D,
  capsuleAnchor: Object3D
): number {
  capsuleAnchor.updateMatrixWorld(true);
  _meshBoundsBox.setFromObject(model);
  _meshBoundsMin.copy(_meshBoundsBox.min);
  capsuleAnchor.worldToLocal(_meshBoundsMin);
  return _meshBoundsMin.y;
}

function measureClipFootBottomY(
  animRoot: Object3D,
  capsuleAnchor: Object3D,
  registry: AnimationClipRegistry,
  clipId: string
): number | null {
  const clip = registry.getClip(clipId);
  if (clip === undefined) {
    return null;
  }

  const mixer = new AnimationMixer(animRoot);
  const action = mixer.clipAction(clip);
  action.play();
  mixer.setTime(0);
  mixer.update(0);
  capsuleAnchor.updateMatrixWorld(true);

  return lowestFootYInCapsuleSpace(animRoot, capsuleAnchor);
}


export function measureStanceMeshAnchors(
  model: Object3D,
  registry: AnimationClipRegistry
): StanceMeshAnchors {
  const capsuleAnchor = new Group();
  model.position.set(0, 0, 0);
  capsuleAnchor.add(model);

  const animRoot = findAnimationRoot(model);
  const standFootY =
    measureClipFootBottomY(animRoot, capsuleAnchor, registry, STAND_LOCOMOTION_CLIP_ID) ?? 0;
  const crouchFootY =
    measureClipFootBottomY(animRoot, capsuleAnchor, registry, CROUCH_LOCOMOTION_CLIP_ID) ??
    standFootY;

  capsuleAnchor.remove(model);

  if (import.meta.env.DEV) {
    console.info('[Stance] mesh foot anchors (m)', { standFootY, crouchFootY });
  }

  return { standFootY, crouchFootY };
}


export function anchorCharacterMeshFromAnimatedFeet(
  character: Object3D,
  capsuleRoot: Object3D,
  lowCapsule: boolean
): void {
  const animRoot = findAnimationRoot(character);
  character.position.y = 0;
  capsuleRoot.updateMatrixWorld(true);
  const footY = lowestFootYInCapsuleSpace(animRoot, capsuleRoot);
  character.position.set(0, characterMeshOffsetYFromFootY(lowCapsule, footY), 0);
  character.rotation.set(0, 0, 0);
}

export function anchorCharacterMeshToStance(
  character: Object3D,
  anchors: StanceMeshAnchors,
  crouching: boolean
): void {
  character.position.set(0, characterMeshOffsetY(crouching, anchors), 0);
  character.rotation.set(0, 0, 0);
}
