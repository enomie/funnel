import {
  DoubleSide,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Scene,
  Vector3
} from 'three/webgpu';
import type { ProjectileVisualKind } from '../combat/weapon-definitions';
import {
  brightenImpactColor,
  IMPACT_BURST_DURATION_MS,
  IMPACT_BURST_OPACITY_FADE,
  IMPACT_BURST_START_SCALE
} from './sphere-vfx-tuning';
import { projectileCoreRadius } from '../combat/projectile-visuals';
import {
  PROJECTILE_GLOW_LAYERS,
  projectileCoreMaterial,
  projectileGlowLayerMaterial
} from '../combat/projectile-materials';
import { getUnitLowPolySphereGeometry } from './low-poly-sphere-geometry';
import { hiddenInstanceMatrix } from './instance-hidden-matrix';

const PROJECTILE_INSTANCES_PER_COLOR = 128;
const IMPACT_BURST_INSTANCES_PER_COLOR = 64;

const _position = new Vector3();
const _scale = new Vector3(1, 1, 1);
const _quaternion = new Quaternion();
const _matrix = new Matrix4();

const IMPACT_BURST_MATERIAL_CACHE = new Map<number, MeshBasicMaterial>();

interface InstancedLayer {
  readonly mesh: InstancedMesh;
  readonly freeSlots: number[];
  readonly inUse: Uint8Array;
  readonly colored: boolean;
  readonly slotOpacity: Float32Array;
  maxSlotUsed: number;
}

export interface InstancedProjectileVisual {
  readonly kind: ProjectileVisualKind;
  readonly color: number;
  coreSlot: number;
  glowSlots: number[];
}

export interface InstancedImpactBurst {
  readonly color: number;
  readonly slot: number;
  readonly spawnedAtMs: number;
  readonly durationMs: number;
  readonly startScale: number;
  readonly endScale: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** 0–1 timeline fraction when scale reaches `endScale`. Default 1. */
  readonly expandPeakFraction?: number;
  /** Expand easing — `cubic` snaps larger faster (explosions). Default `quad`. */
  readonly expandEase?: 'quad' | 'cubic';
  readonly opacityFade?: number;
  /** >1 keeps opacity longer before tail-out. Default 1. */
  readonly opacityFadePower?: number;
  /** After expand peak, scale shrinks to `endScale * this` (0–1). Omit to hold peak size. */
  readonly contractEndScaleFraction?: number;
  /** Peak opacity (0–1) before fade curve. Default 1. */
  readonly opacityPeak?: number;
  readonly hotBurst?: boolean;
}

function impactBurstMaterialForColor(color: number, hot = false): MeshBasicMaterial {
  const cacheKey = hot ? color ^ 0x800000 : color;
  const cached = IMPACT_BURST_MATERIAL_CACHE.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const material = new MeshBasicMaterial({
    color: brightenImpactColor(color, hot),
    transparent: true,
    opacity: 1,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false
  });
  IMPACT_BURST_MATERIAL_CACHE.set(cacheKey, material);
  return material;
}

export class SphereInstancingService {
  readonly #scene: Scene;
  readonly #layers = new Map<string, InstancedLayer>();

  constructor(scene: Scene) {
    this.#scene = scene;
  }

  acquireProjectile(kind: ProjectileVisualKind, color: number): InstancedProjectileVisual | null {
    const colorKey = String(color);
    const coreSlot = this.#acquireSlot(
      `projectile-core:${colorKey}`,
      color,
      PROJECTILE_INSTANCES_PER_COLOR,
      0,
      false
    );
    if (coreSlot < 0) {
      return null;
    }

    const glowSlots: number[] = [];
    for (let layerIndex = 0; layerIndex < PROJECTILE_GLOW_LAYERS.length; layerIndex += 1) {
      const glowSlot = this.#acquireSlot(
        `projectile-glow-${String(layerIndex)}:${colorKey}`,
        color,
        PROJECTILE_INSTANCES_PER_COLOR,
        layerIndex + 1,
        false
      );
      if (glowSlot < 0) {
        this.#releaseSlot(`projectile-core:${colorKey}`, coreSlot);
        for (let rollback = 0; rollback < glowSlots.length; rollback += 1) {
          this.#releaseSlot(`projectile-glow-${String(rollback)}:${colorKey}`, glowSlots[rollback]);
        }
        return null;
      }
      glowSlots.push(glowSlot);
    }

    return { kind, color, coreSlot, glowSlots };
  }

  releaseProjectile(visual: InstancedProjectileVisual): void {
    const colorKey = String(visual.color);
    this.#releaseSlot(`projectile-core:${colorKey}`, visual.coreSlot);
    for (let layerIndex = 0; layerIndex < visual.glowSlots.length; layerIndex += 1) {
      this.#releaseSlot(
        `projectile-glow-${String(layerIndex)}:${colorKey}`,
        visual.glowSlots[layerIndex]
      );
    }
  }

  syncProjectile(visual: InstancedProjectileVisual, x: number, y: number, z: number, visualScale: number): void {
    const colorKey = String(visual.color);
    const coreRadius = projectileCoreRadius(visual.kind) * visualScale;
    this.#setMatrix(`projectile-core:${colorKey}`, visual.coreSlot, x, y, z, coreRadius);
    for (let layerIndex = 0; layerIndex < PROJECTILE_GLOW_LAYERS.length; layerIndex += 1) {
      const layerScale = PROJECTILE_GLOW_LAYERS[layerIndex].scale;
      this.#setMatrix(
        `projectile-glow-${String(layerIndex)}:${colorKey}`,
        visual.glowSlots[layerIndex],
        x,
        y,
        z,
        coreRadius * layerScale
      );
    }
  }

  spawnImpactBurst(
    color: number,
    x: number,
    y: number,
    z: number,
    endScale: number,
    durationMs = IMPACT_BURST_DURATION_MS,
    startScale = IMPACT_BURST_START_SCALE,
    spawnedAtMs = performance.now(),
    profile: {
      expandPeakFraction?: number;
      expandEase?: 'quad' | 'cubic';
      contractEndScaleFraction?: number;
      opacityPeak?: number;
      opacityFade?: number;
      opacityFadePower?: number;
      hotBurst?: boolean;
    } = {}
  ): InstancedImpactBurst | null {
    const layerKey = profile.hotBurst ? `impact:hot:${String(color)}` : `impact:${String(color)}`;
    const slot = this.#acquireSlot(layerKey, color, IMPACT_BURST_INSTANCES_PER_COLOR, 6, true);
    if (slot < 0) {
      return null;
    }

    const burst: InstancedImpactBurst = {
      color,
      slot,
      spawnedAtMs,
      durationMs,
      startScale,
      endScale,
      x,
      y,
      z,
      expandPeakFraction: profile.expandPeakFraction,
      expandEase: profile.expandEase,
      contractEndScaleFraction: profile.contractEndScaleFraction,
      opacityPeak: profile.opacityPeak,
      opacityFade: profile.opacityFade,
      opacityFadePower: profile.opacityFadePower,
      hotBurst: profile.hotBurst
    };
    this.#syncImpactBurst(burst, spawnedAtMs);
    return burst;
  }

  tickImpactBurst(burst: InstancedImpactBurst, nowMs: number): boolean {
    const done = this.#syncImpactBurst(burst, nowMs);
    if (done) {
      this.#releaseSlot(this.#impactLayerKey(burst), burst.slot);
    }
    return done;
  }

  releaseImpactBurst(burst: InstancedImpactBurst): void {
    this.#releaseSlot(this.#impactLayerKey(burst), burst.slot);
  }

  #impactLayerKey(burst: InstancedImpactBurst): string {
    return burst.hotBurst ? `impact:hot:${String(burst.color)}` : `impact:${String(burst.color)}`;
  }

  #syncImpactBurst(burst: InstancedImpactBurst, nowMs: number): boolean {
    const elapsed = nowMs - burst.spawnedAtMs;
    const progress = Math.min(1, elapsed / burst.durationMs);
    const expandPeak = burst.expandPeakFraction ?? 1;
    const contractEnd = burst.contractEndScaleFraction;
    let scale: number;

    if (contractEnd !== undefined && progress > expandPeak && expandPeak < 1) {
      const shrinkProgress = (progress - expandPeak) / (1 - expandPeak);
      const easedShrink = 1 - (1 - shrinkProgress) * (1 - shrinkProgress);
      const minScale = burst.endScale * contractEnd;
      scale = burst.endScale + (minScale - burst.endScale) * easedShrink;
    } else {
      const expandProgress = expandPeak > 0 ? Math.min(1, progress / expandPeak) : 1;
      const eased =
        burst.expandEase === 'cubic'
          ? 1 - (1 - expandProgress) ** 3
          : 1 - (1 - expandProgress) * (1 - expandProgress);
      scale = burst.startScale + (burst.endScale - burst.startScale) * eased;
    }
    const opacityFade = burst.opacityFade ?? IMPACT_BURST_OPACITY_FADE;
    const fadePower = burst.opacityFadePower ?? 1;
    const opacityPeak = burst.opacityPeak ?? 1;
    const opacity = Math.max(0, opacityPeak * (1 - opacityFade * progress ** fadePower));
    this.#setBurstVisual(
      this.#impactLayerKey(burst),
      burst.slot,
      burst.x,
      burst.y,
      burst.z,
      scale,
      opacity
    );
    return progress >= 1;
  }

  #setBurstVisual(
    key: string,
    slot: number,
    x: number,
    y: number,
    z: number,
    scale: number,
    opacity: number
  ): void {
    const layer = this.#layers.get(key);
    const clampedOpacity = Math.max(0, opacity);
    const fadeScale = scale * clampedOpacity;
    this.#setMatrix(key, slot, x, y, z, fadeScale);

    if (layer === undefined || !layer.colored) {
      return;
    }

    layer.slotOpacity[slot] = clampedOpacity;
    this.#syncBurstLayerOpacity(layer);
  }

  #syncBurstLayerOpacity(layer: InstancedLayer): void {
    let maxOpacity = 0;
    for (let slot = 0; slot <= layer.maxSlotUsed; slot += 1) {
      if (layer.inUse[slot] === 0) {
        continue;
      }
      maxOpacity = Math.max(maxOpacity, layer.slotOpacity[slot]);
    }

    const material = layer.mesh.material;
    if (material instanceof MeshBasicMaterial) {
      material.opacity = maxOpacity;
    }
  }

  #acquireSlot(
    key: string,
    color: number,
    capacity: number,
    renderOrder: number,
    colored: boolean
  ): number {
    const layer = this.#ensureLayer(key, color, capacity, renderOrder, colored);
    const slot = layer.freeSlots.pop();
    if (slot === undefined) {
      return -1;
    }

    layer.inUse[slot] = 1;
    layer.maxSlotUsed = Math.max(layer.maxSlotUsed, slot);
    return slot;
  }

  #releaseSlot(key: string, slot: number): void {
    const layer = this.#layers.get(key);
    if (layer === undefined || layer.inUse[slot] === 0) {
      return;
    }

    layer.mesh.setMatrixAt(slot, hiddenInstanceMatrix());
    layer.mesh.instanceMatrix.needsUpdate = true;
    if (layer.colored) {
      layer.slotOpacity[slot] = 0;
      this.#syncBurstLayerOpacity(layer);
    }
    layer.inUse[slot] = 0;
    layer.freeSlots.push(slot);
    if (slot === layer.maxSlotUsed) {
      while (layer.maxSlotUsed >= 0 && layer.inUse[layer.maxSlotUsed] === 0) {
        layer.maxSlotUsed -= 1;
      }
    }
    layer.mesh.count = layer.maxSlotUsed >= 0 ? layer.maxSlotUsed + 1 : 0;
  }

  #ensureLayer(
    key: string,
    color: number,
    capacity: number,
    renderOrder: number,
    colored: boolean
  ): InstancedLayer {
    const existing = this.#layers.get(key);
    if (existing !== undefined) {
      return existing;
    }

    const prefix = key.split(':')[0] ?? '';
    let material;
    if (prefix === 'projectile-core') {
      material = projectileCoreMaterial(color);
    } else if (prefix.startsWith('projectile-glow-')) {
      const layerIndex = Number(prefix.slice('projectile-glow-'.length));
      material = projectileGlowLayerMaterial(color, layerIndex);
    } else if (key.startsWith('impact:hot:')) {
      material = impactBurstMaterialForColor(color, true);
    } else {
      material = impactBurstMaterialForColor(color);
    }

    const mesh = new InstancedMesh(getUnitLowPolySphereGeometry(), material, capacity);
    mesh.name = `instanced-sphere-${key}`;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = renderOrder;
    mesh.count = 0;

    const freeSlots: number[] = [];
    const inUse = new Uint8Array(capacity);
    const slotOpacity = new Float32Array(capacity);
    for (let slot = capacity - 1; slot >= 0; slot -= 1) {
      freeSlots.push(slot);
      mesh.setMatrixAt(slot, hiddenInstanceMatrix());
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.#scene.add(mesh);

    const layer: InstancedLayer = { mesh, freeSlots, inUse, colored, slotOpacity, maxSlotUsed: -1 };
    this.#layers.set(key, layer);
    return layer;
  }

  #setMatrix(key: string, slot: number, x: number, y: number, z: number, radius: number): void {
    this.#setMatrixNonUniform(key, slot, x, y, z, radius, radius, radius);
  }

  #setMatrixNonUniform(
    key: string,
    slot: number,
    x: number,
    y: number,
    z: number,
    scaleX: number,
    scaleY: number,
    scaleZ: number
  ): void {
    const layer = this.#layers.get(key);
    if (layer === undefined) {
      return;
    }

    _matrix.compose(
      _position.set(x, y, z),
      _quaternion.identity(),
      _scale.set(scaleX, scaleY, scaleZ)
    );
    layer.mesh.setMatrixAt(slot, _matrix);
    layer.mesh.instanceMatrix.needsUpdate = true;
    layer.maxSlotUsed = Math.max(layer.maxSlotUsed, slot);
    layer.mesh.count = layer.maxSlotUsed + 1;
  }
}
