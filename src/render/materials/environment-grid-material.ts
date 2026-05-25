import { MeshStandardNodeMaterial } from 'three/webgpu';
import type { FunnelZoneId } from '../../arena/funnel-zones';
import { TEAM_BASE_HEX } from '../../combat/teams';
import { PICKUP_FIELD_CONFIG } from '../../config/game-config';
import {
  buildWorldGridColorNode,
  buildWorldGridEmissiveNode,
  GRID_BASE_COLOR
} from './grid-tsl';

const NEUTRAL_GRID_COLOR = 0x7b7b7b;
const JUMP_PAD_GRID_COLOR = PICKUP_FIELD_CONFIG.shield.color;
/** Walk-through pads — readable grid without looking ghostly. */
const JUMP_PAD_GRID_OPACITY = 0.62;
const JUMP_PAD_GRID_EMISSIVE = 0.5;

const ZONE_GRID_COLOR: Record<FunnelZoneId, number> = {
  alpha: TEAM_BASE_HEX.enemy,
  neutral: NEUTRAL_GRID_COLOR,
  beta: TEAM_BASE_HEX.ally
};

const MATERIAL_CACHE = new Map<string, MeshStandardNodeMaterial>();
let jumpPadGridMaterialCached: MeshStandardNodeMaterial | null = null;

function materialCacheKey(zoneId: FunnelZoneId): string {
  return `${zoneId}-${GRID_BASE_COLOR.toString(16)}`;
}

/** Cached MeshStandardNodeMaterial with procedural world grid (G0+). */
export function zoneGridMaterial(zoneId: FunnelZoneId = 'neutral'): MeshStandardNodeMaterial {
  const cacheKey = materialCacheKey(zoneId);
  const cached = MATERIAL_CACHE.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const material = new MeshStandardNodeMaterial({
    roughness: 0.78,
    metalness: 0.12
  });
  material.name = `zone-grid-${zoneId}`;
  material.colorNode = buildWorldGridColorNode(ZONE_GRID_COLOR[zoneId]);
  material.emissiveNode = buildWorldGridEmissiveNode(ZONE_GRID_COLOR[zoneId]);
  MATERIAL_CACHE.set(cacheKey, material);
  return material;
}

/** Transparent turquoise world grid — jump pads on team podiums. */
export function jumpPadGridMaterial(): MeshStandardNodeMaterial {
  if (jumpPadGridMaterialCached !== null) {
    return jumpPadGridMaterialCached;
  }

  const material = new MeshStandardNodeMaterial({
    roughness: 0.78,
    metalness: 0.12,
    transparent: true,
    opacity: JUMP_PAD_GRID_OPACITY,
    depthWrite: false
  });
  material.name = 'jump-pad-grid';
  material.colorNode = buildWorldGridColorNode(JUMP_PAD_GRID_COLOR);
  material.emissiveNode = buildWorldGridEmissiveNode(
    JUMP_PAD_GRID_COLOR,
    JUMP_PAD_GRID_COLOR,
    JUMP_PAD_GRID_EMISSIVE
  );
  jumpPadGridMaterialCached = material;
  return material;
}
