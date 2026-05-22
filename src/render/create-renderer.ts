import {
  ACESFilmicToneMapping,
  SRGBColorSpace,
  WebGPURenderer
} from 'three/webgpu';

export async function createRenderer(canvas: HTMLCanvasElement): Promise<WebGPURenderer> {
  const renderer = new WebGPURenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });

  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.setClearColor(0x050607, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  await renderer.init();

  return renderer;
}
