// Path: /Users/johann/MyBrew/funnel-real/src/render/materials/environment-dynamic-style.ts

import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  buildObjectGridColorNode,
  buildObjectGridEmissiveNode,
  GRID_BASE_COLOR
} from './grid-tsl';


export const DYNAMIC_GRID_MAJOR = 0xea7028;


export const DYNAMIC_GRID_MINOR = 0x8a4218;


const DYNAMIC_GRID_LINE_STRENGTH_SCALE = 2.4;
const DYNAMIC_GRID_EMISSIVE_STRENGTH = 0.42;

const MATERIAL_CACHE_KEY = `dynamic-${GRID_BASE_COLOR.toString(16)}-${DYNAMIC_GRID_MAJOR.toString(16)}-${DYNAMIC_GRID_MINOR.toString(16)}`;

let cachedMaterial: MeshStandardNodeMaterial | undefined;


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
