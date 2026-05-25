import { AdditiveBlending, MeshBasicMaterial } from 'three/webgpu';

/** Stacked additive shells — inner bright, outer faint (fake bloom). */
export const PROJECTILE_GLOW_LAYERS = [
  { scale: 1.03, opacity: 0.34 },
  { scale: 1.06, opacity: 0.26 },
  { scale: 1.09, opacity: 0.19 },
  { scale: 1.12, opacity: 0.12 },
  { scale: 1.15, opacity: 0.06 }
] as const;

export const PROJECTILE_OUTER_GLOW_SCALE =
  PROJECTILE_GLOW_LAYERS[PROJECTILE_GLOW_LAYERS.length - 1].scale;

const CORE_CACHE = new Map<number, MeshBasicMaterial>();
const GLOW_LAYER_CACHE = new Map<string, MeshBasicMaterial>();

function additiveMaterial(hex: number, opacity: number, name: string): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: hex,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
    name
  });
}

export function projectileCoreMaterial(hex: number): MeshBasicMaterial {
  const cached = CORE_CACHE.get(hex);
  if (cached !== undefined) {
    return cached;
  }

  const material = additiveMaterial(hex, 1, `projectile-core-${hex.toString(16)}`);
  CORE_CACHE.set(hex, material);
  return material;
}

export function projectileGlowLayerMaterial(hex: number, layerIndex: number): MeshBasicMaterial {
  const safeIndex = Math.max(0, Math.min(layerIndex, PROJECTILE_GLOW_LAYERS.length - 1));
  const layer = PROJECTILE_GLOW_LAYERS[safeIndex];
  const cacheKey = `${hex.toString(16)}:${String(safeIndex)}`;
  const cached = GLOW_LAYER_CACHE.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const material = additiveMaterial(
    hex,
    layer.opacity,
    `projectile-glow-${String(safeIndex)}-${hex.toString(16)}`
  );
  GLOW_LAYER_CACHE.set(cacheKey, material);
  return material;
}

export function projectileGlowLayerOpacity(layerIndex: number, powerFraction: number): number {
  if (layerIndex < 0 || layerIndex >= PROJECTILE_GLOW_LAYERS.length) {
    return 0;
  }

  const layer = PROJECTILE_GLOW_LAYERS[layerIndex];
  const power = Math.max(0, Math.min(1, powerFraction));
  return layer.opacity * power;
}

export function isProjectileGlowMeshName(name: string): boolean {
  return name.startsWith('projectile-glow-');
}

export function projectileGlowMeshLayerIndex(name: string): number {
  return Number(name.slice('projectile-glow-'.length));
}
