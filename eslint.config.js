import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './_growing_trees/tsconfig.json'],
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  {
    rules: {
      '@typescript-eslint/no-deprecated': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ]
    }
  },
  {
    files: ['src/main.ts', 'src/character-system/character-system-run-game.ts'],
    rules: {
      // Animation loop: WebGPURenderer.render may be async or typed as void.
      '@typescript-eslint/no-floating-promises': 'off'
    }
  },
  {
    files: ['src/game/game-run-game.ts'],
    rules: {
      // ESLint IDE sometimes surfaces no-unsafe-* here; CLI + tsc agree.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off'
    }
  },
  {
    files: ['src/character/character-animation/character-play-mode-animation-pipeline.ts'],
    rules: {
      // IDE occasionally marks CharacterRigPlaybackState fields as error-typed; CLI + tsc agree.
      '@typescript-eslint/no-unsafe-argument': 'off'
    }
  },
  {
    files: ['src/character/character-audio/character-audio-parachute-open-close.ts'],
    rules: {
      // IDE noise on config imports + AudioContext scheduling; CLI + tsc agree.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/restrict-plus-operands': 'off'
    }
  },
  {
    files: ['src/game/game-materials/wood/wood-node-material.ts'],
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      // TSL / three.js nodematerial: heavy any from upstream typings; keep local shader readable.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off'
    }
  },
  {
    files: [
      'src/character/character-animation/character-animation-integration.ts',
      'src/character/character-animation/character-delta-converter.ts',
      'src/character/character-animation/character-layer-composer.ts'
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/restrict-plus-operands': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off'
    }
  },
  {
    files: ['src/character/character-animation/character-delta-clips.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/require-await': 'off'
    }
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '_deleted/**',
      '_from_github/**',
      '.backups/**',
      '_growing_trees/.backups/**',
      '_growing_trees/_deleted/**',
      '_growing_trees/dist/**',
      '_growing_trees/reference/**',
      '_growing_trees/vite.config.ts',
      '_growing_trees_erste-versionen/**',
      'eslint.config.js',
      'vite.config.ts',
      'scripts/**',
      '_growing_trees/scripts/**',
      '_Scripts/**/*.mjs',
      '_Learnings/**',
      'src/character-new/**',
      'src/_main_game_INFO/**',
      '_game_infos/**'
    ]
  }
);
