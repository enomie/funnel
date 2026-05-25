import { AnimationUtils, type AnimationClip } from 'three/webgpu';
import type { AnimationClipRegistry } from './animation-clip-registry';

/** Mixamo exports ~30 fps; subclip frame indices use this. */
const MIXAMO_FPS = 30;

/**
 * `jump-up` full clip: stand → deepest crouch (~40%) → extend back to stand.
 * Only the crouch/launch window is used at physics takeoff (not the return-to-stand tail).
 */
const JUMP_UP_TAKEOFF_END_NORM = 0.42;

/**
 * `jump-down`: still pose until ~0.50, then knee absorb (~0.50–0.72), then stand-up tail.
 * Subclip = drop + short absorb only (no ledge idle, no full extension to idle).
 */
const JUMP_DOWN_LAND_START_NORM = 0.5;
const JUMP_DOWN_LAND_END_NORM = 0.84;

export const VERTICAL_JUMP_SUBCLIP_IDS = {
  takeoff: 'jump-up-takeoff',
  land: 'jump-down-land'
} as const;

function frameIndex(durationSec: number, norm: number): number {
  return Math.max(0, Math.floor(durationSec * norm * MIXAMO_FPS));
}

export function registerVerticalJumpSubclips(registry: AnimationClipRegistry): void {
  const jumpUp = registry.getClip('jump-up');
  if (jumpUp !== undefined) {
    const endFrame = Math.max(1, frameIndex(jumpUp.duration, JUMP_UP_TAKEOFF_END_NORM));
    registerSubclip(registry, VERTICAL_JUMP_SUBCLIP_IDS.takeoff, jumpUp, 0, endFrame);
  }

  const jumpDown = registry.getClip('jump-down');
  if (jumpDown !== undefined) {
    const startFrame = frameIndex(jumpDown.duration, JUMP_DOWN_LAND_START_NORM);
    const endFrame = Math.max(
      startFrame + 1,
      frameIndex(jumpDown.duration, JUMP_DOWN_LAND_END_NORM)
    );
    registerSubclip(registry, VERTICAL_JUMP_SUBCLIP_IDS.land, jumpDown, startFrame, endFrame);
  }
}

function registerSubclip(
  registry: AnimationClipRegistry,
  clipId: string,
  source: AnimationClip,
  startFrame: number,
  endFrame: number
): void {
  if (registry.hasClip(clipId)) {
    return;
  }

  const sub = AnimationUtils.subclip(source, clipId, startFrame, endFrame, MIXAMO_FPS);
  registry.registerClip(clipId, sub);
}
