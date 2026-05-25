// Path: /Users/johann/MyBrew/funnel-real/src/core/frame-housekeeping.ts

import { tickAllWorldEffects } from '../combat/world-effects-registry';
import { tickGameAudio } from '../game-audio/audio-manager';
import type { SegmentLineInstancingService } from '../render/segment-line-instancing';

export interface FrameHousekeepingDeps {
  readonly segmentLineInstancing: SegmentLineInstancingService;
}

/**
 * Central per-frame cleanup path — never load-shed lifecycle ticks here.
 * Spawn/sync shedding is passed only into world-effects sources.
 */
export function tickFrameHousekeeping(
  frameNowMs: number,
  deltaSeconds: number,
  loadShedNonCritical: boolean,
  deps: FrameHousekeepingDeps
): void {
  tickGameAudio(frameNowMs);

  if (deps.segmentLineInstancing.hasActive()) {
    deps.segmentLineInstancing.tick(frameNowMs);
  }

  tickAllWorldEffects(frameNowMs, deltaSeconds, loadShedNonCritical);
}
