# Instancing & Low-Poly Spheres (VFX)

Stand: Mai 2026 — WebGPU (`three/webgpu`), Arena-Stress mit ~40 Akteuren.

## Ziel

Weniger Draw Calls und weniger Geometrie-Varianten bei sustained fire: alle **Kugel-VFX** nutzen **ein** low-poly Ikosaeder; wiederholte Meshes laufen über **`InstancedMesh`** statt pro Projektil/Burst ein eigenes `Mesh`.

## Geometrie

| Vorher | Nachher |
|--------|---------|
| `SphereGeometry` (8–32 Segmente) | `IcosahedronGeometry(1, 0)` — **20 Faces** |
| Radius oft als eigene Geometrie | Radius nur über **World-/Instance-Matrix** (uniform scale) |

Shared Modul: `src/render/low-poly-sphere-geometry.ts` → `getUnitLowPolySphereGeometry()`.

**Ausnahmen (kein Ikosaeder):** Ripper-Primärvisual = `TorusGeometry` (Ring); Bio-Charge-Preview bleibt am Muzzle parented.

## Zentraler Service — Kugeln

`SphereInstancingService` in `src/render/sphere-instancing.ts` — **eine Scene-weite Instanz**, erzeugt in `funnel-app.ts`.

**Projektil-Slots** (acquire / sync / release) laufen ausschließlich über `WorldProjectileSim` — nicht mehr pro `WeaponArsenal`. Hitscan-Impact-Bursts weiterhin direkt in `HitscanWeapon`.

Durchgereicht an:

- `WorldProjectileSim` (alle fliegenden Projektile + Impact-/Redeemer-Bursts aus Detonationen)
- `HitscanWeapon` (Beam/Pistol-Impact-Bursts)

### Instanced Pools (pro Waffenfarbe)

| Pool-Key | Inhalt | Kapazität/Farbe | Draw Calls |
|----------|--------|-------------------|------------|
| `projectile:{color}` | Fliegende Kugel-Projektile (Glow im TSL-Shader) | 128 | 1 × ~10 Farben |
| `impact:{color}` | Impact-Burst (Treffer/Ricochet) | 64 | 1 × ~10 Farben |
| `redeemer:{color}` | Redeemer-Detonation | 10 | 1 × ~10 Farben |

Projektil-Glow: **`docs/glow.md`** — kein `core:` / `glow:` / `ripper-glow:` mehr.

Worst Case Kugel-VFX: **~30 Draw Calls** (10 Farben × 3 Layer-Typen), statt hunderte Einzelmeshes.

### Ripper (hybrid)

| Teil | Rendering |
|------|-----------|
| **Torus** | Einzelmesh — TSL-Glow + Power-Fade pro Ricochet (`projectile-glow-tsl.ts`, `ripper-disk.ts`) |

Spawn: `createRipperCoreVisual()` — kein separates Instanced-Glow-Mesh.

## Segment-Linien (Trails + Hitscan-Traces)

`SegmentLineInstancingService` in `src/render/segment-line-instancing.ts` — shared Unit-`BoxGeometry`, orientiert entlang Start→Ende (Midpoint + Y-Scale = Segmentlänge).

| Pool-Key | Inhalt | Kapazität/Farbe | TTL |
|----------|--------|-----------------|-----|
| `line:{color}` | Projektil-Trail + Hitscan-Tracer | 128 | 90 ms / 55 ms |

- **Ein Draw Call pro Waffenfarbe** statt pro Segment `Line` + `BufferGeometry`
- Expiry: zentral `segmentLineInstancing.tick(now)` in `funnel-app.ts` (swap-pop)
- Hitscan-Traces: immer aktiv (Gatling/Pistol/Shock)
- **Projektil-Trails:** nur wenn `DEBUG_CONFIG.showProjectileRays === true` (`game-config.ts`, Default **`false`**) — Spawn in `WorldProjectileSim`, Rapier-Raycasts unabhängig davon

## Zentraler Sim-Tick — `WorldProjectileSim`

`src/combat/world-projectile-sim.ts` — **eine Match-weite Projektil-Simulation** für Player + alle Bots. `WeaponArsenal` **feuert nur** (`spawn`); Sim, Visual-Sync und Rapier-Collision laufen zentral.

Registriert sich als `WorldEffectsSource` in `world-effects-registry.ts` — getickt via **ein** `tickAllWorldEffects()` in `funnel-app.ts` (nach Combat-Fire, vor `render`).

### Loop-Reihenfolge

```
physics (fixedStep × N)
  → humanoid visual sync
  → combat fire (Arsenal spawn → Sim)
  → tickAllWorldEffects()     ← WorldProjectileSim + Arsenal (Hitscan/Bursts/Ammo)
  → segmentLineInstancing.tick()
  → render
```

### Owner-Modell

Jedes `WeaponArsenal` registriert eine `ProjectileSimBridge` (`ownerId`, `ignoredBody`, `maxActive`, Impact-Callbacks):

| Owner | `maxActive` | Projectile-Lights |
|-------|-------------|-------------------|
| Player | 96 | 8 (`PointLight`-Pool im Sim) |
| Bot (je) | 8 | aus |

- **Spawn:** `projectileSim.spawn(ownerId, weapon, fire, impact, …)` → stabile `projectileId`
- **Tod / Teardown:** `releaseOwner(ownerId)` — Instanced-Slots + Meshes sofort frei
- **Guided Redeemer:** `setOwnerAim(ownerId, yaw, pitch)` vor Tick; Steering im Sim

### Lifecycle (keine Luft-Hänger)

| Regel | Wert / Verhalten |
|-------|------------------|
| Max-Flight-TTL | 12 s (`DEFAULT_PROJECTILE_MAX_FLIGHT_MS`) |
| Out-of-bounds | Funnel ± 12 m Margin → Detonation + Release |
| Shrapnel | Eigene `ProjectileSpawnLimits` (Reichweite + ~400 ms) |
| Remove | Immer `releaseProjectile` / `releaseRipperGlow` / `detachSceneObject` |

Shock-Combo-Orbs: `listShockOrbs(ownerId)` mit **`projectileId`** (nicht Array-Index) — siehe `shock-combo.ts`.

### `WorldProjectile` → Instancing

| Feld | Instancing |
|------|------------|
| `instanced` | `core:{color}` + `glow:{color}` — sync pro Frame in Sim |
| `ripperGlow` | `ripper-glow:{color}` — ellipsoid scale + Power-Fade |
| `object` | Ripper-Torus oder Kugel-Fallback — `scene.remove` + dispose bei Release |

Sync/Release: `#syncProjectileVisual`, `#removeProjectileAt` in `world-projectile-sim.ts` (nicht mehr in `weapon-arsenal.ts`).

## Statische Arena — `ArenaStaticInstances`

`src/arena/arena-static-instances.ts` — erzeugt in `createFunnelArena()`, durchgereicht via `environment-cube.ts` (Visual) + Rapier (Collider unverändert pro Box).

| Layer | Geometrie | Instanzen (ca.) | Draw Calls |
|-------|-----------|-----------------|------------|
| `arena-boxes-{zone}` | Unit-Box, Matrix-Scale | alpha 21 · neutral 7 · beta 21 | **3** |
| `ceiling-fixture-shell-{zone}` | Troffer-Gehäuse (5 Flächen, offen unten) | ~32 pro Zone | **3** |
| `ceiling-fixture-panel-{zone}` | Emissive Unterseite (unter Öffnung, kein Z-Fight) | ~32 pro Zone | **3** |

Enthält: Spawn-Shields, Ecken, Podium, Canopies, Decken-Troffer. **~120 Einzelmeshes → 9 Draw Calls.**

Shell (Böden/Wände/Bulkheads) bleibt Einzelmesh — unterschiedliche Größen, kein Instancing.

## Pickups (Health + Shield)

`src/arena/pickup-field.ts`: **6 shield spheres + 6 health boxes → 2 `InstancedMesh` pools**. Rapier dynamic bodies — air-drop spawn, sync while awake, instant air respawn on collect. See [`environment-dynamic.md`](environment-dynamic.md) § Pickups.

## Burst-Tuning

Konstanten + `brightenImpactColor()` in `src/render/sphere-vfx-tuning.ts`.  
API-Wrapper: `src/combat/projectile-impact-visual.ts`, Redeemer-Visual in `src/combat/redeemer-blast.ts`.

## Fade (Impact / Redeemer / Ripper-Glow) — kein Schwarz-Aus

**Problem:** Erster Instancing-Stand dimmte `instanceColor` mit `RGB × opacity` → Bursts wurden **schwarz**, statt transparent auszublenden. WebGPU-`InstancedMesh` unterstützt **kein per-Instance-Alpha** (nur RGB über `instanceColor`).

**Lösung:**

1. Volle Burst-Farbe im **Material** (`brightenImpactColor`, `toneMapped: false`)
2. **Pro Instanz:** `fadeScale = scale × opacity` in der Instance-Matrix (schrumpft pro Burst / Ripper-Glow)
3. **Pro Layer:** `material.opacity` = Maximum der aktiven Slot-Opacities (Bursts)
4. **`instanceColor` entfernt** für Burst-Layer

## Integration (Arsenal → Sim)

`WeaponArsenal` ruft nur `#spawnProjectile` → `projectileSim.spawn(...)`. Kein lokales `#projectiles[]`, kein `#updateProjectiles`.

Impact-/Redeemer-Bursts aus **Detonationen** liegen im Sim (`#impactBursts`, `#redeemerBlasts`). Hitscan-Bursts bleiben in `HitscanWeapon`.

## Bereits vorher instanziert (Arena)

- Dynamische Environment-Props: `src/arena/environment-dynamic-instances.ts`
- Regen-Wellen: `icosahedron` / Box-Specs in `environment-dynamic-shapes.ts`

## Verwandte Optimierungen (gleiche Session)

- **World-Effects-Registry:** ein Post-Physics-Tick für Sim + Arsenal-VFX (`world-effects-registry.ts`)
- **Dispose zentral:** `dispose-three.ts` — Scene-Detach + GPU-Release (`releaseOwner` nutzt dasselbe Muster)
- **Team-Material-Pool:** 4 shared Materials statt ~40× Tint (`src/player/team-visual-colors.ts`)
- **Shadow-LOD:** Distanz zum Spieler → cast/receive aus (`src/render/shadow-lod.ts`)
- **Shadow Map:** 1024², player-zentriertes Frustum (`src/render/create-scene.ts`)

## Dateien (Kurz)

```
src/render/low-poly-sphere-geometry.ts   # Unit-Ikosaeder
src/render/sphere-vfx-tuning.ts          # Burst-Konstanten
src/render/sphere-instancing.ts          # SphereInstancingService
src/render/segment-line-instancing.ts    # Trails + Hitscan-Traces
src/render/dispose-three.ts              # GPU-Release (Meshes + Subtrees)
src/combat/world-projectile-sim.ts       # Zentrale Projektil-Sim + Burst-Tick
src/combat/world-effects-registry.ts     # tickAllWorldEffects()
src/combat/projectile-visuals.ts         # Radien, Ripper-Core, Material-Caches
src/combat/weapon-arsenal.ts             # Fire only → projectileSim.spawn
src/app/funnel-app.ts                    # Bootstrap + tickAllWorldEffects
src/arena/arena-static-instances.ts      # Statische Boxen + Troffer
src/arena/environment-cube.ts            # Collider + Visual-Registrierung
```

## Mögliche nächste Schritte

| Priorität | Thema | Nutzen |
|-----------|-------|--------|
| 1 | **`BatchedMesh`** für Impact/Redeemer-Bursts (RGBA r183+) | saubereres per-Instance-Alpha |
| 2 | **Funnel-Shell** merge / zone-batched Planes | weniger Shell-Draw-Calls |
| 3 | Bio-Preview in Viewmodel-Rig statt Welt-Scene | Depth/Sortierung |
| 4 | Global projectile cap im Sim (über Owner-Summe) | harte Obergrenze bei 40 Akteuren sustained fire |
