import { FUNNEL_ZONE_COUNT, funnelZoneExtentZ } from '../config/game-config';
import { oppositeFaction, type FactionTeam } from '../combat/teams';

/** World-fixed tunnel segments along Z (alpha north → neutral → beta south). */
export type FunnelZoneId = 'alpha' | 'neutral' | 'beta';

const ZONE_IDS: readonly FunnelZoneId[] = ['alpha', 'neutral', 'beta'];

/** Resolve which funnel segment contains world Z (full tunnel width — X ignored). */
export function resolveFunnelZoneAtZ(worldZ: number): FunnelZoneId {
  for (let index = 0; index < FUNNEL_ZONE_COUNT; index += 1) {
    const { minZ, maxZ } = funnelZoneExtentZ(index);
    if (worldZ >= minZ && worldZ < maxZ) {
      return ZONE_IDS[index] ?? 'neutral';
    }
  }

  return worldZ < 0 ? 'alpha' : 'beta';
}

/** Opponent spawn/home zone for intrusion scoring. */
export function enemyHomeZoneFor(faction: FactionTeam): Extract<FunnelZoneId, 'alpha' | 'beta'> {
  return oppositeFaction(faction);
}

/** True when `worldZ` lies in the opposing faction's home zone (not neutral). */
export function isInEnemyTerritory(faction: FactionTeam, worldZ: number): boolean {
  return resolveFunnelZoneAtZ(worldZ) === enemyHomeZoneFor(faction);
}
