import { AnimationMixer, type AnimationClip, type Object3D } from 'three/webgpu';
import { AnimationClipRegistry, findAnimationRoot } from './animation-clip-registry';
import { remapAnimationClipToBoneNames } from './collada-animation-remap';
import { clipToUpperBodyOnly } from './collada-upper-body-clip';
import { stripInPlaceRootMotion } from './collada-strip-root-motion';
import { disposeColladaScene, loadColladaFromUrl } from './collada-asset-loader';
import {
  formatInspectionForDocs,
  inspectShooterPackLoad,
  type ShooterPackInspection
} from './collada-inspector';
import { logUnboundShooterPackClips } from './shooter-pack-bindings';
import { discoverShooterPackAnimations } from './shooter-pack-manifest';
import { clipIdFromShooterPackFile, shooterPackModelUrl } from './shooter-pack-paths';

export interface ShooterPackCharacter {
  /** Visual root added to the player (scaled/positioned). */
  model: Object3D;
  mixer: AnimationMixer;
  registry: AnimationClipRegistry;
  inspection: ShooterPackInspection;
}

export async function loadShooterPackCharacter(): Promise<ShooterPackCharacter> {
  const base = await loadColladaFromUrl(shooterPackModelUrl());
  const model = base.scene;
  model.name = 'y-bot-player';

  const animationRoot = findAnimationRoot(model);
  const mixer = new AnimationMixer(animationRoot);
  const registry = new AnimationClipRegistry(mixer);

  const animationEntries = discoverShooterPackAnimations();
  const loadedClips: { clipId: string; clip: AnimationClip }[] = [];

  const animationLoads = animationEntries.map(async ({ fileName, url, clipId }) => {
    const parsed = await loadColladaFromUrl(url);

    if (parsed.animations.length === 0) {
      console.warn(`[Shooter-Pack] No animations in ${fileName}`);
      disposeColladaScene(parsed.scene);
      return;
    }

    parsed.animations.forEach((clip, index) => {
      let remapped = stripInPlaceRootMotion(remapAnimationClipToBoneNames(clip, parsed.scene));
      if (clipId === 'firing-rifle') {
        remapped = clipToUpperBodyOnly(remapped);
      }
      registry.registerClip(clipId, remapped, index);
      loadedClips.push({
        clipId: index === 0 ? clipId : `${clipId}__${String(index)}`,
        clip: remapped
      });
    });

    disposeColladaScene(parsed.scene);
  });

  await Promise.all(animationLoads);

  const registeredClipIds = registry.getClipIds();
  logUnboundShooterPackClips(registeredClipIds);

  if (import.meta.env.DEV) {
    console.info(
      `[Shooter-Pack] Discovered ${String(animationEntries.length)} animation file(s) via import.meta.glob`
    );
  }

  const inspection = inspectShooterPackLoad(model, base, loadedClips, registeredClipIds);

  if (import.meta.env.DEV) {
    const docs = formatInspectionForDocs(inspection);
    console.info('[Shooter-Pack] Doc snapshot (paste into docs/ if needed):\n', docs.animationsText);
  }

  return { model, mixer, registry, inspection };
}

export { clipIdFromShooterPackFile };
