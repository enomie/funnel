// Path: /Users/johann/MyBrew/funnel-real/src/arena/environment-rain-waves.ts

import { ENVIRONMENT_CONFIG } from '../config/game-config';
import type { DynamicPropSpec } from './environment-dynamic-shapes';
import { RAIN_WAVE_CATALOG, type EnvironmentRainShapeId } from './environment-rain-catalog';

export type { EnvironmentRainShapeId } from './environment-rain-catalog';

export interface RainWaveSpec {
  readonly id: EnvironmentRainShapeId;
  readonly count: number;
  readonly shape: DynamicPropSpec;
}

export function isEnvironmentRainEnabled(): boolean {
  if (!ENVIRONMENT_CONFIG.rainEnabled) {
    return false;
  }

  for (const wave of RAIN_WAVE_CATALOG) {
    if (ENVIRONMENT_CONFIG.rainCounts[wave.id] > 0) {
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
    const count = ENVIRONMENT_CONFIG.rainCounts[wave.id];
    if (count > 0) {
      waves.push({ id: wave.id, count, shape: wave.shape });
    }
  }

  return waves;
}
