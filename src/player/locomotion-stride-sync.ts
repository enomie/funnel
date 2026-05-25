import { PLAYER_CONFIG } from '../config/game-config';

const TIME_SCALE_MIN = 0.35;
const TIME_SCALE_MAX = 6.5;

/** Loop duration from `docs/animations.txt` (sanity / docs only). */
export const CLIP_CYCLE_DURATION_SECONDS: Readonly<Record<string, number>> = {
  walking: 1.367,
  'rifle-run': 0.733,
  'walking-backwards': 1.4,
  'run-backwards': 0.533,
  strafe: 0.667,
  'strafe-2': 0.533
};

/**
 * Measured Mixamo hip XZ path per in-place cycle (m) — regen: `npm run measure:locomotion-stride`.
 * Phase clock and timeScale derive from this, not guessed scale factors.
 */
export const CLIP_HIP_PLANAR_PATH_METERS: Readonly<Record<string, number>> = {
  walking: 1.3153,
  'rifle-run': 2.2246,
  'walking-backwards': 1.4826,
  'run-backwards': 1.4125,
  strafe: 2.1174,
  'strafe-2': 1.4467
};

/** One gait clock for the whole blend space — walk/run forward clips, not per-layer duration. */
export function locomotionGaitReferenceClipId(sprint: boolean): string {
  return sprint ? 'rifle-run' : 'walking';
}

function scaledHipPathMeters(clipId: string): number | undefined {
  if (!Object.hasOwn(CLIP_HIP_PLANAR_PATH_METERS, clipId)) {
    return undefined;
  }

  return CLIP_HIP_PLANAR_PATH_METERS[clipId] * PLAYER_CONFIG.locomotionStrideScale;
}

function measuredReferenceSpeedMps(clipId: string): number | undefined {
  const pathMeters = scaledHipPathMeters(clipId);
  if (pathMeters === undefined) {
    return undefined;
  }

  if (!Object.hasOwn(CLIP_CYCLE_DURATION_SECONDS, clipId)) {
    return undefined;
  }

  return pathMeters / CLIP_CYCLE_DURATION_SECONDS[clipId];
}

export function referenceSpeedForClip(clipId: string, _worldSpeedMps = 0): number | undefined {
  return measuredReferenceSpeedMps(clipId);
}

export function clampLocomotionTimeScale(scale: number): number {
  return Math.min(TIME_SCALE_MAX, Math.max(TIME_SCALE_MIN, scale));
}

/**
 * timeScale so in-world speed matches locomotion cycle:
 * worldSpeed ≈ (hipPath / duration) × timeScale
 */
export function computeLocomotionTimeScale(clipId: string, worldSpeedMps: number): number {
  const reference = referenceSpeedForClip(clipId);
  if (reference === undefined || reference <= 0) {
    return 1;
  }

  if (worldSpeedMps < 0.08) {
    return 1;
  }

  return clampLocomotionTimeScale(worldSpeedMps / reference);
}

/** Prefer measured body speed so playback tracks Rapier velocity (instant on ground). */
export function locomotionSyncSpeedMps(bodySpeedMps: number, inputTargetMps: number): number {
  if (inputTargetMps < 0.08) {
    return bodySpeedMps < 0.15 ? 0 : bodySpeedMps;
  }

  if (bodySpeedMps >= inputTargetMps * 0.88) {
    return bodySpeedMps;
  }

  return inputTargetMps * 0.94;
}

const STEPS_PER_LOCOMOTION_CYCLE = 4;

export function locomotionCycleDurationSeconds(clipId: string): number | undefined {
  if (!Object.hasOwn(CLIP_CYCLE_DURATION_SECONDS, clipId)) {
    return undefined;
  }

  return CLIP_CYCLE_DURATION_SECONDS[clipId];
}

export function stepDistanceMeters(
  clipId: string,
  syncSpeedMps: number,
  timeScale: number
): number {
  const cycleDuration = locomotionCycleDurationSeconds(clipId);
  if (cycleDuration === undefined || syncSpeedMps < 0.12) {
    return PLAYER_CONFIG.walkSpeed * 0.28;
  }

  const cycleTimeSeconds = cycleDuration / timeScale;
  return (syncSpeedMps * cycleTimeSeconds) / STEPS_PER_LOCOMOTION_CYCLE;
}

export function isLocomotionClipWithFootsteps(clipId: string): boolean {
  return locomotionCycleDurationSeconds(clipId) !== undefined;
}

/** Meters the capsule travels during one normalized locomotion cycle when feet are in sync. */
export function locomotionMetersPerCycle(clipId: string): number {
  const pathMeters = scaledHipPathMeters(clipId);
  if (pathMeters !== undefined) {
    return pathMeters;
  }

  const duration = locomotionCycleDurationSeconds(clipId);
  const reference = referenceSpeedForClip(clipId);
  if (duration === undefined || reference === undefined) {
    return PLAYER_CONFIG.walkSpeed * 0.38;
  }

  return reference * duration;
}

/** Manual phase clock — keeps all blend-space layers on the same footfall phase. */
export function advanceLocomotionPhase(
  phase: number,
  worldSpeedMps: number,
  referenceClipId: string,
  deltaSeconds: number
): number {
  if (worldSpeedMps < 0.08 || deltaSeconds <= 0) {
    return phase;
  }

  const cycleMeters = locomotionMetersPerCycle(referenceClipId);
  if (cycleMeters <= 0.001) {
    return phase;
  }

  return (phase + (worldSpeedMps * deltaSeconds) / cycleMeters) % 1;
}
