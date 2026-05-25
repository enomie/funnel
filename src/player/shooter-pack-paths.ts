// Path: /Users/johann/MyBrew/funnel-real/src/player/shooter-pack-paths.ts

import { assetUrl } from '../utils/asset-url';
import {
  DEFAULT_HUMANOID_RIG,
  HUMANOID_RIG_MODEL_FILES,
  type HumanoidRigId
} from './humanoid-rig';

const SHOOTER_PACK_DIR = 'Shooter-Pack';


export const SHOOTER_PACK_BASE_MODEL = HUMANOID_RIG_MODEL_FILES[DEFAULT_HUMANOID_RIG];


export const SHOOTER_PACK_EXCLUDED_DAE = new Set(Object.values(HUMANOID_RIG_MODEL_FILES));


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


export function shooterPackAnimationUrl(fileName: string): string {
  return assetUrl(`${SHOOTER_PACK_DIR}/${fileName}`);
}


export function clipIdFromShooterPackFile(fileName: string): string {
  const base = fileName.replace(/\.dae$/i, '');
  if (!base.startsWith('animation-')) {
    return base;
  }

  return base.slice('animation-'.length);
}
