// Path: /Users/johann/MyBrew/funnel-real/src/render/materials/pulse-beam-tsl.ts
// @ts-nocheck


import { FrontSide, AdditiveBlending, Color, MeshBasicNodeMaterial } from 'three/webgpu';
import {
  float,
  length,
  mx_noise_float,
  positionGeometry,
  sin,
  smoothstep,
  uniform,
  uv,
  vec2
} from 'three/tsl';

export interface PulseBeamMaterialHandle {
  readonly material: MeshBasicNodeMaterial;
  setTime: (seconds: number) => void;
}

const MATERIAL_CACHE = new Map<number, PulseBeamMaterialHandle>();

function buildBeamIntensityNode(timeNode: ReturnType<typeof uniform>) {
  const radial = length(vec2(positionGeometry.x, positionGeometry.z));
  const radialMask = smoothstep(float(1.12), float(0.08), radial);
  const along = uv().y;
  const flow = mx_noise_float(
    vec2(along.mul(float(24)), timeNode.mul(float(7))),
    float(1),
    float(0)
  );
  const pulse = sin(along.mul(float(56)).add(timeNode.mul(float(26))))
    .mul(float(0.5))
    .add(float(0.5));
  return radialMask.mul(float(0.58).add(flow.mul(float(0.24))).add(pulse.mul(float(0.18))));
}


export function pulseBeamMaterial(hex: number): PulseBeamMaterialHandle {
  const cached = MATERIAL_CACHE.get(hex);
  if (cached !== undefined) {
    return cached;
  }

  const timeNode = uniform(0);
  const intensity = buildBeamIntensityNode(timeNode);
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: FrontSide,
    blending: AdditiveBlending,
    toneMapped: false
  });
  material.name = `pulse-beam-tsl-${hex.toString(16)}`;
  material.colorNode = uniform(new Color(hex)).mul(intensity);
  material.opacityNode = intensity.mul(float(0.94));

  const handle: PulseBeamMaterialHandle = {
    material,
    setTime(seconds: number) {
      timeNode.value = seconds;
    }
  };
  MATERIAL_CACHE.set(hex, handle);
  return handle;
}
