// vite.config.ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { stripRapierDevSourceMap } from './vite-rapier-firefox-dev';

const root = path.dirname(fileURLToPath(import.meta.url));

/** Addons use bare `import 'three'` (WebGL build); app code uses `three/webgpu` — same file, one runtime. */
const threeWebgpuEntry = path.join(root, 'node_modules/three/build/three.webgpu.js');

/** Use only `@dimforge/rapier3d-simd-compat` (`rapier.mjs`). */
const rapierSimdEntry = path.join(root, 'node_modules/@dimforge/rapier3d-simd-compat/rapier.mjs');

export default defineConfig({
  plugins: [stripRapierDevSourceMap()],
  /**
   * Relative asset URLs so `dist` can be deployed under any subfolder
   * (for example on shared hosting with PHP/Apache only).
   */
  base: './',
  /** Fallback if HMR client is loaded without replacement. */
  define: {
    __BUNDLED_DEV__: 'false',
    __APP_VERSION__: JSON.stringify('v.0.0.1')
  },
  build: {
    rollupOptions: {
      input: {
        index: path.join(root, 'index.html'),
        game: path.join(root, 'game.html')
      }
    }
  },
  resolve: {
    dedupe: ['@dimforge/rapier3d-simd-compat'],
    /** Only the bare `three` specifier — do not match `three/webgpu` or `three/addons/...`. */
    alias: [
      { find: /^three$/, replacement: threeWebgpuEntry },
      { find: '@dimforge/rapier3d-simd-compat', replacement: rapierSimdEntry },
      { find: '@dimforge/rapier3d-compat', replacement: rapierSimdEntry }
    ]
  },
  server: {
    port: 3011,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-simd-compat']
  },
  assetsInclude: ['**/*.dae']
});
