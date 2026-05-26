// Path: /Users/johann/MyBrew/funnel-real/src/render/webgpu-adapter-shim.ts

import { isFirefox } from '../platform/chrome-macos-arm-profile';

let shimInstalled = false;

/**
 * Three.js requests `featureLevel: "compatibility"`. Firefox does not support that yet
 * and logs a console warning while falling back to core. Request core up front instead.
 */
export function installWebGpuAdapterFeatureLevelShim(): void {
  if (shimInstalled || typeof navigator === 'undefined' || !('gpu' in navigator)) {
    return;
  }

  if (!isFirefox()) {
    return;
  }

  shimInstalled = true;

  const gpu = navigator.gpu;
  const requestAdapter = gpu.requestAdapter.bind(gpu);

  gpu.requestAdapter = (options) => {
    if (options?.featureLevel === 'compatibility') {
      return requestAdapter({ ...options, featureLevel: 'core' });
    }

    return requestAdapter(options);
  };
}
