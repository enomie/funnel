// Path: /Users/johann/MyBrew/funnel-real/src/render/materials/rocket-smoke-trail-tsl.ts
// @ts-nocheck


import { DoubleSide, MeshBasicNodeMaterial, NormalBlending } from 'three/webgpu';
import {
  float,
  instancedDynamicBufferAttribute,
  length,
  mix,
  smoothstep,
  uv,
  vec2,
  vec3
} from 'three/tsl';

const SMOKE_COOL_COLOR = vec3(0.28, 0.27, 0.26);
const SMOKE_WARM_COLOR = vec3(0.62, 0.58, 0.52);
const SMOKE_HOT_COLOR = vec3(1.0, 0.78, 0.42);
const SMOKE_ALPHA_COOL = 0.62;
const SMOKE_ALPHA_HOT = 0.88;

let cachedMaterial: MeshBasicNodeMaterial | undefined;
let cachedLifetimeArray: Float32Array | undefined;
let cachedHeatArray: Float32Array | undefined;

function buildSmokeColorNode(heatNode: ReturnType<typeof instancedDynamicBufferAttribute>) {
  const warmMix = mix(SMOKE_COOL_COLOR, SMOKE_WARM_COLOR, heatNode.mul(float(0.55)));
  return mix(warmMix, SMOKE_HOT_COLOR, heatNode);
}

function buildSmokeOpacityNode(
  lifetimeNode: ReturnType<typeof instancedDynamicBufferAttribute>,
  heatNode: ReturnType<typeof instancedDynamicBufferAttribute>
) {
  const dist = length(uv().sub(float(0.5)).mul(vec2(1.08, 0.78)).mul(float(2)));
  const radialAlpha = smoothstep(float(1), float(0.04), dist);
  const alphaBase = mix(float(SMOKE_ALPHA_COOL), float(SMOKE_ALPHA_HOT), heatNode);
  return radialAlpha.mul(lifetimeNode).mul(alphaBase);
}


export function rocketSmokeTrailMaterial(
  lifetimeArray: Float32Array,
  heatArray: Float32Array
): MeshBasicNodeMaterial {
  if (
    cachedMaterial !== undefined &&
    cachedLifetimeArray === lifetimeArray &&
    cachedHeatArray === heatArray
  ) {
    return cachedMaterial;
  }

  const lifetimeNode = instancedDynamicBufferAttribute(lifetimeArray, 'float');
  const heatNode = instancedDynamicBufferAttribute(heatArray, 'float');
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: DoubleSide,
    blending: NormalBlending,
    toneMapped: false
  });
  material.name = 'rocket-smoke-trail-tsl';
  material.colorNode = buildSmokeColorNode(heatNode);
  material.opacityNode = buildSmokeOpacityNode(lifetimeNode, heatNode);
  cachedMaterial = material;
  cachedLifetimeArray = lifetimeArray;
  cachedHeatArray = heatArray;
  return material;
}
