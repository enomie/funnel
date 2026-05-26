// Path: /Users/johann/MyBrew/funnel-real/src/render/create-renderer.ts

import {
  ACESFilmicToneMapping,
  SRGBColorSpace,
  WebGPURenderer
} from 'three/webgpu';
import { getRendererPixelRatio, getRuntimeProfile } from '../platform/chrome-macos-arm-profile';
import { installWebGpuAdapterFeatureLevelShim } from './webgpu-adapter-shim';

export async function createRenderer(canvas: HTMLCanvasElement): Promise<WebGPURenderer> {
  const profile = getRuntimeProfile();
  installWebGpuAdapterFeatureLevelShim();

  const renderer = new WebGPURenderer({
    canvas,
    antialias: profile.rendererAntialias,
    samples: profile.rendererSamples,
    alpha: false,
    forceWebGL: false,
    powerPreference: 'high-performance'
  });

  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.82;
  renderer.shadowMap.enabled = profile.shadowsEnabled;
  renderer.setClearColor(0x050607, 1);
  renderer.setPixelRatio(getRendererPixelRatio());
  await renderer.init();

  return renderer;
}
