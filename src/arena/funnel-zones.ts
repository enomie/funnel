// Path: /Users/johann/MyBrew/funnel-real/src/arena/funnel-zones.ts

import { FUNNEL_ZONE_COUNT, funnelZoneExtentZ } from '../config/game-config';
import { oppositeFaction, type FactionTeam } from '../combat/teams';


export type FunnelZoneId = 'alpha' | 'neutral' | 'beta';

const ZONE_IDS: readonly FunnelZoneId[] = ['alpha', 'neutral', 'beta'];


export function resolveFunnelZoneAtZ(worldZ: number): FunnelZoneId {
  for (let index = 0; index < FUNNEL_ZONE_COUNT; index += 1) {
    const { minZ, maxZ } = funnelZoneExtentZ(index);
    if (worldZ >= minZ && worldZ < maxZ) {
      return ZONE_IDS[index] ?? 'neutral';
    }
  }

  return worldZ < 0 ? 'alpha' : 'beta';
}


export function enemyHomeZoneFor(faction: FactionTeam): Extract<FunnelZoneId, 'alpha' | 'beta'> {
  return oppositeFaction(faction);
}


export function isInEnemyTerritory(faction: FactionTeam, worldZ: number): boolean {
  return resolveFunnelZoneAtZ(worldZ) === enemyHomeZoneFor(faction);
}
