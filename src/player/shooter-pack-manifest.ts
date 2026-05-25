import {
  CHARACTER_SELECT_UI_CLIP_IDS,
  clipIdFromShooterPackFile,
  SHOOTER_PACK_EXCLUDED_DAE
} from './shooter-pack-paths';

/** Build-time discovery of `public/Shooter-Pack/animation-*.dae` (excludes base model). */
const animationModules = import.meta.glob(
  '../../public/Shooter-Pack/animation-*.dae',
  { query: '?url', import: 'default', eager: true }
);

export interface ShooterPackAnimationEntry {
  fileName: string;
  url: string;
  clipId: string;
}

export function discoverShooterPackAnimations(): ShooterPackAnimationEntry[] {
  const entries: ShooterPackAnimationEntry[] = [];

  for (const [modulePath, url] of Object.entries(animationModules)) {
    const fileName = modulePath.split('/').pop() ?? modulePath;
    const clipId = clipIdFromShooterPackFile(fileName);
    if (SHOOTER_PACK_EXCLUDED_DAE.has(fileName) || CHARACTER_SELECT_UI_CLIP_IDS.has(clipId)) {
      continue;
    }

    entries.push({
      fileName,
      url: url as string,
      clipId
    });
  }

  entries.sort((a, b) => a.clipId.localeCompare(b.clipId));
  return entries;
}
