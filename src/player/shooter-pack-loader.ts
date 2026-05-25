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
import { DEFAULT_HUMANOID_RIG, type HumanoidRigId } from './humanoid-rig';
import { logUnboundShooterPackClips } from './shooter-pack-bindings';
import { registerVerticalJumpSubclips } from './vertical-jump-subclips';
import { discoverShooterPackAnimations } from './shooter-pack-manifest';
import { clipIdFromShooterPackFile, shooterPackModelUrlForRig } from './shooter-pack-paths';

export interface ShooterPackCharacter {
  /** Visual root added to the player (scaled/positioned). */
  model: Object3D;
  mixer: AnimationMixer;
  registry: AnimationClipRegistry;
  inspection: ShooterPackInspection;
  rigId: HumanoidRigId;
}

interface CachedAnimationClip {
  clipId: string;
  index: number;
  clip: AnimationClip;
}

interface ShooterPackAnimationCache {
  clips: CachedAnimationClip[];
  registeredClipIds: string[];
}

let animationCache: ShooterPackAnimationCache | null = null;

async function ensureShooterPackAnimations(): Promise<ShooterPackAnimationCache> {
  if (animationCache !== null) {
    return animationCache;
  }

  const animationEntries = discoverShooterPackAnimations();
  const clips: CachedAnimationClip[] = [];
  const registeredClipIds = new Set<string>();

  const animationLoads = animationEntries.map(async ({ fileName, url, clipId }) => {
    const parsed = await loadColladaFromUrl(url);

    if (parsed.animations.length === 0) {
      console.warn(`[Shooter-Pack] No animations in ${fileName}`);
      disposeColladaScene(parsed.scene);
      return;
    }

    parsed.animations.forEach((clip, index) => {
      let remapped = stripInPlaceRootMotion(
        remapAnimationClipToBoneNames(clip, parsed.scene),
        clipId
      );
      if (clipId === 'firing-rifle') {
        remapped = clipToUpperBodyOnly(remapped);
      }
      clips.push({ clipId, index, clip: remapped });
      registeredClipIds.add(index === 0 ? clipId : `${clipId}__${String(index)}`);
    });

    disposeColladaScene(parsed.scene);
  });

  await Promise.all(animationLoads);

  if (import.meta.env.DEV) {
    console.info(
      `[Shooter-Pack] Discovered ${String(animationEntries.length)} animation file(s) via import.meta.glob`
    );
  }

  animationCache = {
    clips,
    registeredClipIds: [...registeredClipIds].filter((id) => !id.includes('__'))
  };
  return animationCache;
}

function buildRegistry(mixer: AnimationMixer, cache: ShooterPackAnimationCache): AnimationClipRegistry {
  const registry = new AnimationClipRegistry(mixer);
  for (const { clipId, index, clip } of cache.clips) {
    registry.registerClip(clipId, clip, index);
  }
  registerVerticalJumpSubclips(registry);
  logUnboundShooterPackClips(registry.getClipIds());
  return registry;
}

export async function loadShooterPackCharacter(
  rigId: HumanoidRigId = DEFAULT_HUMANOID_RIG
): Promise<ShooterPackCharacter> {
  const cache = await ensureShooterPackAnimations();
  const base = await loadColladaFromUrl(shooterPackModelUrlForRig(rigId));
  const model = base.scene;
  model.name = rigId === 'y-bot' ? 'y-bot-player' : 'x-bot-player';

  const animationRoot = findAnimationRoot(model);
  const mixer = new AnimationMixer(animationRoot);
  const registry = buildRegistry(mixer, cache);

  const loadedClips = cache.clips.map(({ clipId, index, clip }) => ({
    clipId: index === 0 ? clipId : `${clipId}__${String(index)}`,
    clip
  }));

  const inspection = inspectShooterPackLoad(model, base, loadedClips, cache.registeredClipIds);

  if (import.meta.env.DEV && rigId === DEFAULT_HUMANOID_RIG) {
    const docs = formatInspectionForDocs(inspection);
    console.info('[Shooter-Pack] Doc snapshot (paste into docs/ if needed):\n', docs.animationsText);
  }

  return { model, mixer, registry, inspection, rigId };
}

export { clipIdFromShooterPackFile };
