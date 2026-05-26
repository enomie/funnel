// Path: /Users/johann/MyBrew/funnel-real/src/arena/environment-rain-waves.ts

import { ENVIRONMENT_CONFIG } from '../config/game-config';
import { getRuntimeProfile } from '../platform/chrome-macos-arm-profile';
import type { DynamicPropSpec } from './environment-dynamic-shapes';
import { RAIN_WAVE_CATALOG, type EnvironmentRainShapeId } from './environment-rain-catalog';

export type { EnvironmentRainShapeId } from './environment-rain-catalog';

export interface RainWaveSpec {
  readonly id: EnvironmentRainShapeId;
  readonly count: number;
  readonly shape: DynamicPropSpec;
}

function scaledRainPieceCount(baseCount: number): number {
  if (baseCount <= 0) {
    return 0;
  }

  const { rainWaveCountScale } = getRuntimeProfile();
  return Math.max(0, Math.round(baseCount * rainWaveCountScale));
}

export function isEnvironmentRainEnabled(): boolean {
  if (!ENVIRONMENT_CONFIG.rainEnabled) {
    return false;
  }

  for (const wave of RAIN_WAVE_CATALOG) {
    if (scaledRainPieceCount(ENVIRONMENT_CONFIG.rainCounts[wave.id]) > 0) {
      return true;
    }
  }
  return false;
}

export function resolveRainWaves(): readonly RainWaveSpec[] {
  if (!ENVIRONMENT_CONFIG.rainEnabled) {
    return [];
  }

  const waves: RainWaveSpec[] = [];

  for (const wave of RAIN_WAVE_CATALOG) {
    const count = scaledRainPieceCount(ENVIRONMENT_CONFIG.rainCounts[wave.id]);
    if (count > 0) {
      waves.push({ id: wave.id, count, shape: wave.shape });
    }
  }

  return waves;
}
