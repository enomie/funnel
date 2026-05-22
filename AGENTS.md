# FUNNEL — Agent Guide

State-of-the-art **WebGPU + Rapier SIMD** arena FPS (UT99-inspired). Spec: `docs/introduction.md`.

## Commands

```bash
npm run dev      # http://localhost:3011/
npm run lint
npm run build
npm run inspect:shooter-pack   # refresh docs/animations.txt + docs/bones.txt
```

## Cursor

| Type | Path |
|------|------|
| Rules (auto) | `.cursor/rules/funnel-*.mdc` |
| Skills (invoke) | `.cursor/skills/funnel/`, `funnel-weapons/`, `funnel-performance/` |

## Code map

- Loop: `src/app/funnel-app.ts`
- Combat: `src/combat/`
- Physics: `src/physics/rapier-world.ts`, `synced-body.ts`
- Player: `src/player/` (Shooter-Pack: `public/Shooter-Pack/`, glob manifest, locomotion FSM; test `K` death / `R` respawn)
- Arena: `src/arena/`

## Non-negotiables

- `three/webgpu` + `@dimforge/rapier3d-simd-compat`
- Small modules, top-of-file tuning constants
- Hit detection via Rapier, not mesh bounds
- After changes: lint + build
