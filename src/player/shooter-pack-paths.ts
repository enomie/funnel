import { assetUrl } from '../utils/asset-url';
import {
  DEFAULT_HUMANOID_RIG,
  HUMANOID_RIG_MODEL_FILES,
  type HumanoidRigId
} from './humanoid-rig';

const SHOOTER_PACK_DIR = 'Shooter-Pack';

/** @deprecated Use `HUMANOID_RIG_MODEL_FILES['y-bot']` or `shooterPackModelUrlForRig`. */
export const SHOOTER_PACK_BASE_MODEL = HUMANOID_RIG_MODEL_FILES[DEFAULT_HUMANOID_RIG];

/** Rig/mesh DAEs in Shooter-Pack that must not be treated as animation clips. */
export const SHOOTER_PACK_EXCLUDED_DAE = new Set(Object.values(HUMANOID_RIG_MODEL_FILES));

/** UI-only clips for character select — excluded from gameplay animation glob. */
export const CHARACTER_SELECT_UI_CLIP_IDS = new Set(['x-idle', 'x-hover', 'y-idle', 'y-hover']);

export const CHARACTER_SELECT_ANIMATION_FILES: Record<
  HumanoidRigId,
  { idle: string; hover: string }
> = {
  'y-bot': { idle: 'animation-y-idle.dae', hover: 'animation-y-hover.dae' },
  'x-bot': { idle: 'animation-x-idle.dae', hover: 'animation-x-hover.dae' }
};

export function shooterPackModelUrlForRig(rigId: HumanoidRigId = DEFAULT_HUMANOID_RIG): string {
  return assetUrl(`${SHOOTER_PACK_DIR}/${HUMANOID_RIG_MODEL_FILES[rigId]}`);
}

export function shooterPackModelUrl(): string {
  return shooterPackModelUrlForRig(DEFAULT_HUMANOID_RIG);
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
