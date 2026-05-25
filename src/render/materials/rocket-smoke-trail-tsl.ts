// Path: /Users/johann/MyBrew/funnel-real/src/render/materials/rocket-smoke-trail-tsl.ts
// @ts-nocheck


import { FrontSide, MeshBasicNodeMaterial, NormalBlending } from 'three/webgpu';
import {
  float,
  instancedDynamicBufferAttribute,
  length,
  smoothstep,
  uv,
  vec3
} from 'three/tsl';

const SMOKE_COLOR = vec3(0.78, 0.76, 0.72);
const SMOKE_ALPHA = 0.38;

let cachedMaterial: MeshBasicNodeMaterial | undefined;
let cachedLifetimeArray: Float32Array | undefined;

function buildSmokeOpacityNode(lifetimeNode: ReturnType<typeof instancedDynamicBufferAttribute>) {
  const dist = length(uv().sub(float(0.5))).mul(float(2));
  const radialAlpha = smoothstep(float(1), float(0.12), dist);
  return radialAlpha.mul(lifetimeNode).mul(float(SMOKE_ALPHA));
}


export function rocketSmokeTrailMaterial(lifetimeArray: Float32Array): MeshBasicNodeMaterial {
  if (cachedMaterial !== undefined && cachedLifetimeArray === lifetimeArray) {
    return cachedMaterial;
  }

  const lifetimeNode = instancedDynamicBufferAttribute(lifetimeArray, 'float');
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: FrontSide,
    blending: NormalBlending,
    toneMapped: false
  });
  material.name = 'rocket-smoke-trail-tsl';
  material.colorNode = SMOKE_COLOR;
  material.opacityNode = buildSmokeOpacityNode(lifetimeNode);
  cachedMaterial = material;
  cachedLifetimeArray = lifetimeArray;
  return material;
}
