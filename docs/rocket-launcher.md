# FUNNEL — Rocket Launcher (Spezialauftrag)

**Stand:** 2026-05-25 — Slot `3`, UT99-Raketenwerfer mit 6-Lauf-Magazin. Phase 1: Smoke-Trail (TSL), leichte Roll-Rotation, Volley folgt Zielrichtung.

---

## Spielverhalten (Soll)

| Modus | Input | Verhalten |
|-------|-------|-----------|
| **LMB** | Einzelschuss | Nächster Lauf im 6er-Ring; Spawn leicht versetzt (`resolveRocketBarrelSpawn`); Flugrichtung = Ziel |
| **RMB halten** | Markieren | Alle ~280 ms eine Rakete vormerken (max. verfügbare Munition) |
| **RMB los** | Volley | N Raketen nacheinander (~105 ms), je Lauf im Ring, Flugrichtung = Ziel (leichter Spread) |

Munition: 6 Schuss, Reload 3 s on empty. Geschwindigkeit 34 m/s, Splash 5 m / 480 dmg.

---

## Phase 1 ✅ (klein anfangen)

| Feature | Status | Code |
|---------|--------|------|
| Smoke-Trail (TSL) | ✅ | `rocket-smoke-trail-tsl.ts`, `rocket-smoke-trail-instancing.ts` |
| Leichte Roll-Rotation | ✅ | `WorldProjectile.rollAngle`, `bolt-instancing.syncBolt` |
| Raketen-Visual elongiert | ✅ | `ROCKET_PROJECTILE_*` in `projectile-visuals.ts`, Bolt-Instancing |
| Volley Zielrichtung + Ring-Spawn | ✅ | `resolveRocketVolleyDirection`, `#emitRocketVolley` |

---

## Smoke-Trail (TSL 2026)

**Kein** Debug-Segment (`DEBUG_CONFIG.showProjectileRays`) — eigener gepoolter Layer.

| Parameter | Wert | Rolle |
|-----------|------|--------|
| `ROCKET_SMOKE_SPAWN_INTERVAL_MS` | 30 | Abstand zwischen Puffs |
| `ROCKET_SMOKE_PUFF_LIFETIME_MS` | 720 | TTL pro Puff |
| `ROCKET_VOLLEY_SHOT_INTERVAL_MS` | 105 | Abstand zwischen Salven-Raketen |
| `ROCKET_SMOKE_PUFFS_MAX` | 96 | Cap (swap-pop) |

**Shader:** `MeshBasicNodeMaterial`, **NormalBlending** (kein Additive-Glow), `DoubleSide`, `toneMapped: false`

1. **Körper** — helles Grau, leichter Wärme-Tint (kein Orange-Feuer)
2. **Radial** — `smoothstep`-Weiche Kante — Wolke, nicht Kugel-Glow
3. **CPU** — flache Box-Puffs (×1.15 / ×0.72 / ×1.15), leichtes Aufsteigen, Fade via Skala

Ein Draw Call (`instanced-rocket-smoke`).

---

## Rotation

Raketen fliegen **gerade** (Physik unverändert). Visual rollt leicht um die Flugrichtung:

- `ROCKET_SPIN_RAD_S = 4.8` (~0,76 U/s)
- Nur `visualKind === 'rocket'`
- Elongiertes Bolt-Mesh → Roll sichtbar (Glow-Schalen folgen noch als Kugel-Instancing — Roadmap: Rocket-only TSL-Körper)

---

## Volley Zielrichtung + Fächer

`resolveRocketVolleyDirection`:

- Volle Zielrichtung (Yaw + Pitch) wie LMB
- Symmetrischer Horizontal-Fächer pro Index (`ROCKET_VOLLEY_FAN_STEP_RAD` / `secondary.spreadRadians`) — parallele Bahnen, keine Ein-Schienen-Salve
- Spawn: `resolveRocketBarrelSpawn` pro Index (Lauf im Ring, seitlich versetzt)

---

## Roadmap (später)

| Stufe | Inhalt |
|-------|--------|
| **B** | Impact: Rauchring statt generischem Burst (`visual-effects.md` Stufe B) |
| **C** | Rocket-only TSL-Körper (Fresnel wie `docs/glow.md`), kein Kugel-Core |
| **D** | RMB Alt: Granaten / enge Spirale (Intro §7) |
| **E** | Muzzle-Rauch beim Laden (Mark-Hold) |

---

## Referenzen

- `src/combat/rocket-launcher.ts` — Magazin, Barrel-Spawn, Volley-Richtung
- `src/combat/weapon-arsenal.ts` — `#emitRocketVolley`, `#tryFireRocketPrimary`
- `src/combat/world-projectile-sim.ts` — Spawn, Trail, Roll-Tick
- `docs/weapons.md`, `docs/visual-effects.md`, `docs/glow.md`
