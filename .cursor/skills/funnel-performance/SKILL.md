---
name: funnel-performance
description: >-
  Optimize FUNNEL for maximum web FPS: WebGPU draw calls, Rapier SIMD, pooling,
  instancing, projectile caps, and stutter-free game loop. Use when profiling,
  lag, GC spikes, too many lights, or performance refactors in src/.
---

# FUNNEL Performance

## Goals

Uninterrupted `setAnimationLoop` at high refresh: zero stutter during sustained fire, many build pieces, and camera motion.

## Loop discipline

- Cap physics sub-steps (`PHYSICS_CONFIG.maxSubSteps`).
- Clamp frame delta (see `funnel-app.ts` `Math.min(..., 0.05)`).
- Sync Rapier → Three **after** `world.step`, via `syncRigidBodyObjects` only for registered bodies.

## Combat / VFX

Patterns already in `weapon-arsenal.ts` — extend, don't replace:

- `Map` caches for trail/impact materials and geometries keyed by color
- `PROJECTILE_LIGHT_POOL_SIZE` — never spawn unbounded `PointLight`s
- `TRAIL_SPAWN_INTERVAL_MS` — throttle trail segments
- TTL removal for impacts/trails without shifting large arrays every frame
- `MAX_COLLISION_STEPS_PER_FRAME` — bound ray steps per projectile per frame

## Arena / build

- Instanced meshes for repeated pillars (`funnel-arena.ts`)
- Fixed Rapier colliders for static shell; dynamic crates synced through `SyncedBody`
- Build pieces: grid snap + occupied-cell check before spawn

## Graphics roadmap

Current: standard WebGPU lights + emissive tubes + fake glow meshes.

Next (when loop is stable): TSL emissive line lights, clustered spotlights, GPU blood/gib particles — all **off** the main-thread hot path.

## Profiling checklist

- [ ] 10 weapons firing: stable frame time, no runaway object count
- [ ] Build mode placing 50+ pieces: instancing still batches where possible
- [ ] Pointer-lock look + sprint + jump: no GC blips in performance panel
- [ ] `npm run build` clean after changes

## Anti-patterns

- `new Vector3()` / `new Mesh()` per projectile per frame
- One dynamic light per bullet
- Mesh-bound hit tests instead of Rapier
- Loading FBX synchronously inside the animation loop
