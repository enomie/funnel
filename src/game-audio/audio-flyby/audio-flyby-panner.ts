// Path: /Users/johann/MyBrew/funnel-real/src/game-audio/audio-flyby/audio-flyby-panner.ts

import type { Vector3 } from 'three/webgpu';
import { syncPannerPositionImmediate, syncPannerVelocityImmediate } from '../audio-spatial-sync';
import { setupSpatialPanner } from '../audio-system';

export function createFlybyPanner(context: AudioContext, position: Vector3): PannerNode {
  const panner = context.createPanner();
  setupSpatialPanner(panner);
  syncPannerPositionImmediate(panner, position);
  return panner;
}

export function syncFlybyPanner(panner: PannerNode, position: Vector3, velocity?: Vector3): void {
  syncPannerPositionImmediate(panner, position);

  if (velocity === undefined) {
    return;
  }

  syncPannerVelocityImmediate(panner, velocity);
}
