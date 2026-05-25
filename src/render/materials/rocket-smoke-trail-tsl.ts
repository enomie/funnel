// @ts-nocheck — TSL node graph; upstream three/tsl typings are incomplete under strict TS.
import { DoubleSide, MeshBasicNodeMaterial, NormalBlending } from 'three/webgpu';
import {
  float,
  instancedDynamicBufferAttribute,
  length,
  mix,
  mx_noise_float,
  smoothstep,
  uv,
  vec3
} from 'three/tsl';

const SMOKE_BASE = vec3(0.82, 0.79, 0.76);
const SMOKE_WARM = vec3(0.88, 0.76, 0.62);
const NOISE_STRENGTH = 0.05;
const SMOKE_ALPHA = 0.62;

let cachedMaterial: MeshBasicNodeMaterial | undefined;
let cachedLifetimeArray: Float32Array | undefined;

function buildSmokeColorNode() {
  const centerUV = uv().sub(float(0.5));
  const noise = mx_noise_float(uv().mul(float(4)), float(1), float(0)).mul(float(NOISE_STRENGTH));
  const dist = length(centerUV).add(noise);
  const warmth = float(1)
    .sub(smoothstep(float(0), float(0.38), dist))
    .mul(float(0.1));
  return mix(SMOKE_BASE, SMOKE_WARM, warmth);
}

function buildSmokeOpacityNode(lifetimeNode: ReturnType<typeof instancedDynamicBufferAttribute>) {
  const centerUV = uv().sub(float(0.5));
  const noise = mx_noise_float(uv().mul(float(4)), float(1), float(0)).mul(float(NOISE_STRENGTH));
  const dist = length(centerUV).add(noise);
  const radialAlpha = smoothstep(float(0.52), float(0.04), dist);
  return radialAlpha.mul(lifetimeNode).mul(float(SMOKE_ALPHA));
}

/** Cached normal-blended smoke for rocket trails — view-facing quads, one draw call. */
export function rocketSmokeTrailMaterial(lifetimeArray: Float32Array): MeshBasicNodeMaterial {
  if (cachedMaterial !== undefined && cachedLifetimeArray === lifetimeArray) {
    return cachedMaterial;
  }

  const lifetimeNode = instancedDynamicBufferAttribute(lifetimeArray, 'float');
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: DoubleSide,
    blending: NormalBlending,
    toneMapped: false
  });
  material.name = 'rocket-smoke-trail-tsl';
  material.colorNode = buildSmokeColorNode();
  material.opacityNode = buildSmokeOpacityNode(lifetimeNode);
  cachedMaterial = material;
  cachedLifetimeArray = lifetimeArray;
  return material;
}
