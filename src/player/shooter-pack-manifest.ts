import {
  clipIdFromShooterPackFile,
  SHOOTER_PACK_BASE_MODEL
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
    if (fileName === SHOOTER_PACK_BASE_MODEL) {
      continue;
    }

    entries.push({
      fileName,
      url: url as string,
      clipId: clipIdFromShooterPackFile(fileName)
    });
  }

  entries.sort((a, b) => a.clipId.localeCompare(b.clipId));
  return entries;
}
