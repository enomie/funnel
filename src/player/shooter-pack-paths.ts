import { assetUrl } from '../utils/asset-url';

const SHOOTER_PACK_DIR = 'Shooter-Pack';

export const SHOOTER_PACK_BASE_MODEL = 'animation-model-y-bot.dae';

export function shooterPackModelUrl(): string {
  return assetUrl(`${SHOOTER_PACK_DIR}/${SHOOTER_PACK_BASE_MODEL}`);
}

/** Fallback when not using build-resolved URLs from `shooter-pack-manifest.ts`. */
export function shooterPackAnimationUrl(fileName: string): string {
  return assetUrl(`${SHOOTER_PACK_DIR}/${fileName}`);
}

/** `animation-walking.dae` → `walking` */
export function clipIdFromShooterPackFile(fileName: string): string {
  const base = fileName.replace(/\.dae$/i, '');
  if (!base.startsWith('animation-')) {
    return base;
  }

  return base.slice('animation-'.length);
}
