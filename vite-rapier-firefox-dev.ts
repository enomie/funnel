// Path: /Users/johann/MyBrew/funnel-real/vite-rapier-firefox-dev.ts

import type { Plugin } from 'vite';

const RAPIER_MJS = '@dimforge/rapier3d-simd-compat/rapier.mjs';
const RAPIER_SOURCEMAP_COMMENT = /\n\/\/# sourceMappingURL=rapier\.mjs\.map\s*$/;

/**
 * Firefox DevTools logs "URL constructor: is not a valid URL" for Rapier's inline WASM
 * (Source Map URL: null). Gameplay is unaffected; drop the JS sourceMappingURL in dev.
 */
export function stripRapierDevSourceMap(): Plugin {
  return {
    name: 'funnel-strip-rapier-dev-sourcemap',
    apply: 'serve',
    transform(code, id) {
      if (!id.includes(RAPIER_MJS) || !RAPIER_SOURCEMAP_COMMENT.test(code)) {
        return;
      }

      return {
        code: code.replace(RAPIER_SOURCEMAP_COMMENT, ''),
        map: null
      };
    }
  };
}
