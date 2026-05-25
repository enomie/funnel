// Path: /Users/johann/MyBrew/funnel-real/src/arena/environment-rain-catalog.ts

import type { DynamicPropSpec } from './environment-dynamic-shapes';


export const RAIN_WAVE_CATALOG = [
  { id: 'cube-5', shape: { kind: 'box', size: [5, 5, 5] } },
  { id: 'cube-3', shape: { kind: 'box', size: [3, 3, 3] } },
  { id: 'cube-2', shape: { kind: 'box', size: [2, 2, 2] } },
  { id: 'slab-20x5x1', shape: { kind: 'box', size: [20, 5, 1] } },
  { id: 'ramp-5x5x10', shape: { kind: 'ramp', width: 5, height: 5, depth: 10 } },
  { id: 'pillar-2x10', shape: { kind: 'box', size: [2, 2, 10] } },
  { id: 'pillar-1x5', shape: { kind: 'box', size: [1, 1, 5] } },
  { id: 'pillar-2x20', shape: { kind: 'box', size: [2, 2, 20] } }
] as const satisfies readonly { readonly id: string; readonly shape: DynamicPropSpec }[];

export type EnvironmentRainShapeId = (typeof RAIN_WAVE_CATALOG)[number]['id'];
