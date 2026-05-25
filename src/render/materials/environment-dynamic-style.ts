import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  buildObjectGridColorNode,
  buildObjectGridEmissiveNode,
  GRID_BASE_COLOR
} from './grid-tsl';

/** Major 5 m grid lines — docs/environment-dynamic.md. */
export const DYNAMIC_GRID_MAJOR = 0xea7028;

/** Inner 1 m grid lines (~52% major brightness). */
export const DYNAMIC_GRID_MINOR = 0x8a4218;

/** 1 m props need stronger lines than 5 m static shell blocks. */
const DYNAMIC_GRID_LINE_STRENGTH_SCALE = 2.4;
const DYNAMIC_GRID_EMISSIVE_STRENGTH = 0.42;

const MATERIAL_CACHE_KEY = `dynamic-${GRID_BASE_COLOR.toString(16)}-${DYNAMIC_GRID_MAJOR.toString(16)}-${DYNAMIC_GRID_MINOR.toString(16)}`;

let cachedMaterial: MeshStandardNodeMaterial | undefined;

/** Cached orange grid material for dynamic rain / debris props. */
export function dynamicGridMaterial(): MeshStandardNodeMaterial {
  if (cachedMaterial !== undefined) {
    return cachedMaterial;
  }

  const material = new MeshStandardNodeMaterial({
    roughness: 0.78,
    metalness: 0.12
  });
  material.name = MATERIAL_CACHE_KEY;
  material.colorNode = buildObjectGridColorNode(
    DYNAMIC_GRID_MAJOR,
    DYNAMIC_GRID_MINOR,
    DYNAMIC_GRID_LINE_STRENGTH_SCALE
  );
  material.emissiveNode = buildObjectGridEmissiveNode(
    DYNAMIC_GRID_MAJOR,
    DYNAMIC_GRID_MINOR,
    DYNAMIC_GRID_EMISSIVE_STRENGTH
  );
  cachedMaterial = material;
  return material;
}
