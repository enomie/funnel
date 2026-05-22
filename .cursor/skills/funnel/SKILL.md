---
name: funnel
description: >-
  Develop FUNNEL, a state-of-the-art WebGPU + Rapier SIMD arena FPS (UT99-inspired).
  Use when working in funnel-real, FUNNEL, web shooter, Three.js WebGPU, Rapier,
  funnel-app, arena shooter, or docs/introduction.md.
---

# FUNNEL Development

## Quick context

- **Playable slice:** `http://localhost:3011/` — pointer lock (`P` or click), WASD, Shift sprint, Space jump, `C` crouch, `1`–`0` weapons, `Q`/`Z`/`V`/`Tab` build, `F` exit build.
- **Entry:** `src/main.ts` → `src/app/funnel-app.ts`
- **Full spec:** [docs/introduction.md](../../docs/introduction.md)

## Architecture

```
Game loop (funnel-app) → Input / Player / Building / Weapons
                      → Rapier fixed-step + syncRigidBodyObjects
                      → WebGPU render (setAnimationLoop)
```

Graphics and physics are **peers**; the loop never owns shader or solver internals.

## Implementation workflow

1. Read the relevant section in `docs/introduction.md` and check existing modules under `src/`.
2. Add or extend a **single-responsibility** file; wire one call site in `funnel-app.ts` if needed.
3. Put module-local tuning constants at the **top of that file**.
4. Run `npm run lint` and `npm run build`.

## Checklist alignment (from intro)

| Area | Key files | Next big items |
|------|-----------|----------------|
| Loop | `funnel-app.ts`, `game-config.ts` | Render interpolation |
| Arena | `funnel-arena.ts`, `building-system.ts` | Editor UI, JSON maps |
| Combat | `weapon-definitions.ts`, `weapon-arsenal.ts` | Primary/secondary fire, ImpactProfile |
| Player | `player-controller.ts`, `player-visual.ts` | Full anim state machine |
| Render | `create-renderer.ts`, `create-scene.ts` | TSL materials, clustered lights |

## Related skills

- Weapons & impacts: [funnel-weapons/SKILL.md](../funnel-weapons/SKILL.md)
- Performance passes: [funnel-performance/SKILL.md](../funnel-performance/SKILL.md)

## Rules

Project rules live in `.cursor/rules/funnel-*.mdc` — follow them automatically when editing matching files.
