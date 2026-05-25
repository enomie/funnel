# FUNNEL — Projektil-Glow (TSL)

**Stand:** 2026-05-23 — Glow für **fliegende Projektile** läuft über **eine** Geometrie + **TSL-Shader**, nicht mehr über eine zweite Glow-Kugel.

Impact-Bursts und Redeemer-Detonation bleiben vorerst separate Instanced-Sphere-Layer (`impact:{color}`, `redeemer:{color}`) — siehe `docs/Instancing.md`.

---

## Problem (vorher)

| Ansatz | Nachteil |
|--------|----------|
| `core:{color}` + `glow:{color}` InstancedMesh | Doppelte Draw Calls, doppelter Slot-Sync pro Projektil |
| Ripper: Torus + `ripper-glow:{color}` Ellipsoid | Dritter Layer, extra Pool, Leak-Risiko |

Glow war eine **größere additive Kugel** (Skala ×1,12) um den Kern — visuell ok, aber teuer und fehleranfällig.

---

## Lösung (jetzt)

**Ein** Low-Poly-Ikosaeder pro Projektil (`projectile:{color}`). Schein im Fragment:

1. **Körper** — Basis-Intensität `1.0` auf der ganzen Fläche (sichtbar auch mit Additive Blending)
2. **Halo** — Fresnel-Rand (`pow 1.35`) + weicher Term (`pow 0.65`) → `color × (1 + rim×0.95 + soft×0.38)`
3. **Größe** — Instancing-Skala = **`projectileGlowRadius`** (×1,12), wie früher die Glow-Hülle
4. **Ripper-Fade** — Uniform `power` (0…1) dimmt Helligkeit + Opacity nach Ricochet

Material: `MeshBasicNodeMaterial`, **additiv**, `depthWrite: false`, `toneMapped: false`.

Tuning-Konstanten in `projectile-glow-tsl.ts`: `PROJECTILE_GLOW_HALO_STRENGTH`, `PROJECTILE_GLOW_FRESNEL_POWER`, `PROJECTILE_GLOW_SOFT_HALO`.

---

## Code

| Datei | Rolle |
|-------|--------|
| `src/render/materials/projectile-glow-tsl.ts` | TSL-Graph, Material-Cache pro Farbe, Ripper-Power-Uniform |
| `src/render/sphere-instancing.ts` | Pool `projectile:{color}` (128/Farbe), kein `glow:` / `ripper-glow:` |
| `src/combat/projectile-visuals.ts` | Fallback-Meshes (voller Pool) nutzen dasselbe Material |
| `src/combat/ripper-disk.ts` | `syncRipperGlowPower()` statt Material-Farbe/Opacity mutieren |

Konstanten: `PROJECTILE_GLOW_HALO_STRENGTH = 0.42` (entspricht altem `GLOW_OPACITY`).

---

## Instancing-Pools (Projektile)

| Pool-Key | Inhalt | Kapazität/Farbe |
|----------|--------|-----------------|
| `projectile:{color}` | Fliegende Kugel-Projektile (Glow im Shader) | 128 |
| *(Ripper Torus)* | Einzelmesh, Glow-Material pro Disk | — |

Entfallen: `core:{color}`, `glow:{color}`, `ripper-glow:{color}`.

Worst-Case Draw Calls Kugel-**Projektile**: **~10** (eine Layer pro Waffenfarbe) statt ~20 (+ Ripper-Glow).

---

## Ripper (Sonderfall)

- **Geometrie:** `TorusGeometry` (Ring), unverändert
- **Glow:** dasselbe TSL-Rezept wie Kugeln, Material **pro Disk** (`createRipperTorusGlowMaterial`) mit eigener Power-Uniform
- Ricochet: `#tryRicochet` → `syncRipperGlowPower(material, ricochetsRemaining / ricochetMax)` — kein separates Instanced-Glow mehr

---

## Fallback (Instanz-Pool voll)

`WorldProjectileSim` spawnt weiterhin `createProjectileVisual()` — eine Kugel/Torus mit TSL, kein Glow-Kind-Mesh.

Bio RMB Charge-Preview am Muzzle: parented Preview, Material-Clone nur für `depthTest: false`.

---

## Nicht in Scope

- Impact-Burst-Expand (weiter Instanced Sphere + Opacity-Fade)
- Redeemer-Detonation (expandierende Kugel, 3 s)
- PointLights — Pool 8, Waffenfarbe; `PROJECTILE_LIGHT_INTENSITY` 5, Range 10 m, Decay 1.25 (Priorität nach `visualKind`)

Roadmap: Bursts optional auf denselben Fresnel+Scale-Shader migrieren, wenn Impact-Layer vereinheitlicht wird.

---

## Referenzen

- `docs/Instancing.md` — Gesamt-Instancing-Architektur
- `src/render/materials/grid-tsl.ts` — bestehendes TSL-Muster im Projekt
- `.cursor/rules/funnel-performance.mdc` — Draw-Call-/Hot-Path-Regeln
