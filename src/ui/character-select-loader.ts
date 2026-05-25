// Path: /Users/johann/MyBrew/funnel-real/src/ui/character-select-loader.ts

import {
  AnimationAction,
  AnimationMixer,
  LoopRepeat,
  type AnimationClip,
  type Object3D
} from 'three/webgpu';
import { findAnimationRoot } from '../player/animation-clip-registry';
import { remapAnimationClipToBoneNames } from '../player/collada-animation-remap';
import { disposeColladaScene, loadColladaFromUrl } from '../player/collada-asset-loader';
import { stripInPlaceRootMotion } from '../player/collada-strip-root-motion';
import type { HumanoidRigId } from '../player/humanoid-rig';
import {
  CHARACTER_SELECT_ANIMATION_FILES,
  shooterPackAnimationUrl,
  shooterPackModelUrlForRig
} from '../player/shooter-pack-paths';

export interface CharacterSelectPreview {
  rigId: HumanoidRigId;
  model: Object3D;
  mixer: AnimationMixer;
  idleAction: AnimationAction;
  hoverAction: AnimationAction;
}

const RIG_IDS: HumanoidRigId[] = ['y-bot', 'x-bot'];

async function loadUiClip(
  fileName: string,
  clipKey: string,
  targetModel: Object3D
): Promise<AnimationClip> {
  const parsed = await loadColladaFromUrl(shooterPackAnimationUrl(fileName));
  if (parsed.animations.length === 0) {
    disposeColladaScene(parsed.scene);
    throw new Error(`[Character-Select] No animation in ${fileName}`);
  }

  
  let remapped = stripInPlaceRootMotion(
    remapAnimationClipToBoneNames(parsed.animations[0], parsed.scene),
    clipKey
  );
  remapped = remapAnimationClipToBoneNames(remapped, targetModel);
  remapped.name = clipKey;
  disposeColladaScene(parsed.scene);
  return remapped;
}

export async function loadCharacterSelectPreview(
  rigId: HumanoidRigId
): Promise<CharacterSelectPreview> {
  const modelAsset = await loadColladaFromUrl(shooterPackModelUrlForRig(rigId));
  const model = modelAsset.scene;
  model.name = `${rigId}-select-preview`;

  const files = CHARACTER_SELECT_ANIMATION_FILES[rigId];
  const [idleClip, hoverClip] = await Promise.all([
    loadUiClip(files.idle, `${rigId}-idle`, model),
    loadUiClip(files.hover, `${rigId}-hover`, model)
  ]);

  const animationRoot = findAnimationRoot(model);
  const mixer = new AnimationMixer(animationRoot);

  const idleAction = mixer.clipAction(idleClip);
  idleAction.setLoop(LoopRepeat, Infinity);
  idleAction.enabled = true;
  idleAction.setEffectiveWeight(1);
  idleAction.play();

  const hoverAction = mixer.clipAction(hoverClip);
  hoverAction.setLoop(LoopRepeat, Infinity);
  hoverAction.enabled = true;
  hoverAction.setEffectiveWeight(0);
  hoverAction.play();

  return { rigId, model, mixer, idleAction, hoverAction };
}

export async function loadAllCharacterSelectPreviews(
  onProgress?: (loaded: number, total: number, rigId: HumanoidRigId) => void
): Promise<CharacterSelectPreview[]> {
  const previews: CharacterSelectPreview[] = [];
  let loaded = 0;

  for (const rigId of RIG_IDS) {
    previews.push(await loadCharacterSelectPreview(rigId));
    loaded += 1;
    onProgress?.(loaded, RIG_IDS.length, rigId);
  }

  return previews;
}
