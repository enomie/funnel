import { FUNNEL_DIMENSIONS, FUNNEL_ZONE_COUNT, funnelZoneExtentZ } from '../config/game-config';
import type { ArenaStaticInstances } from './arena-static-instances';
import type { FunnelZoneId } from './funnel-zones';

const GRID_MODULE_M = 5;

const FIXTURE_WIDTH_M = 2;
const FIXTURE_LENGTH_M = 10;
const FIXTURE_DROP_M = 5;
const FIXTURE_LENGTH_GAP_M = 2;

const FIXTURE_COLUMN_X: readonly number[] = [-15, -10, 10, 15];

const FIXTURE_HALF_LENGTH = FIXTURE_LENGTH_M * 0.5;
const FIXTURE_Z_PITCH_M = FIXTURE_LENGTH_M + FIXTURE_LENGTH_GAP_M;

const FIXTURE_CENTER_Y = FUNNEL_DIMENSIONS.height - FIXTURE_DROP_M * 0.5;

const ZONE_ORDER: readonly FunnelZoneId[] = ['alpha', 'neutral', 'beta'];

function zoneIdForIndex(zoneIndex: number): FunnelZoneId {
  return ZONE_ORDER[zoneIndex] ?? 'neutral';
}

function fixtureCentersZForZone(minZ: number, maxZ: number): number[] {
  const centers: number[] = [];
  const firstCenter = minZ + FIXTURE_HALF_LENGTH;
  const lastCenter = maxZ - FIXTURE_HALF_LENGTH;

  for (let z = firstCenter; z <= lastCenter + 1e-6; z += FIXTURE_Z_PITCH_M) {
    centers.push(z);
  }

  return centers;
}

/** Hanging troffer panels — 2×10 m, 5 m drop, 2 m gap along Z; zone-colored glow underside. */
export function createCeilingFixtures(instances: ArenaStaticInstances): void {
  for (let zoneIndex = 0; zoneIndex < FUNNEL_ZONE_COUNT; zoneIndex += 1) {
    const { minZ, maxZ } = funnelZoneExtentZ(zoneIndex);
    const zoneId = zoneIdForIndex(zoneIndex);
    const zCenters = fixtureCentersZForZone(minZ, maxZ);

    for (const z of zCenters) {
      for (const x of FIXTURE_COLUMN_X) {
        instances.addCeilingFixture(x, z, zoneId);
      }
    }
  }
}

/** Exported for layout docs / tests. */
export const CEILING_FIXTURE_LAYOUT = {
  gridModuleM: GRID_MODULE_M,
  widthM: FIXTURE_WIDTH_M,
  lengthM: FIXTURE_LENGTH_M,
  dropM: FIXTURE_DROP_M,
  lengthGapM: FIXTURE_LENGTH_GAP_M,
  columnX: FIXTURE_COLUMN_X,
  centerY: FIXTURE_CENTER_Y
} as const;
