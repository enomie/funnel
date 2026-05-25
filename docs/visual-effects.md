# FUNNEL — Visual Effects (Impacts & Ricochets)

**Stand:** 2026-05-22 — **Phase A** (einheitlicher Impact-Burst) ist implementiert und als Ausgangsbasis bestätigt. Audio: `docs/audio.md` (spatial Fire/Impact/Fly; Impact-Gain-Fix).

---

## 1. Was im Code ist

| Thema | Status | Code |
|-------|--------|------|
| **Ripper Flugbahn** | ✅ Reflektion + weiterfliegen | `weapon-arsenal.ts` — `reflectDirection`, `ricochetsRemaining` (max 3), nur `visualKind === 'ripper'` |
| **Ripper vs Build** | Treffer auf Build = **kein** Bounce, Projektil endet | `damage()` auf Collider vor Ricochet-Check |
| **Impact-VFX** | ✅ expandierende Kugel | `projectile-impact-visual.ts` — `spawnProjectileImpactBurst`, `updateImpactBurst` |
| **Impact-SFX** | ✅ spatial, hörbar | `weapon-audio.ts` — `createImpactSpatialPanner`, `IMPACT_GAIN_*` |
| **Pooling** | max. 48 Bursts | `#impactBursts` in `weapon-arsenal.ts`; ältester wird verdrängt |

**Wichtig:** Ricochet ist **Spielphysik** (Richtung + Position), nicht nur SFX/VFX. Andere Waffen (Flak-Schrapnell, Ripper-RMB) später über `ImpactProfile.ricochet` — ohne neue Felder in `weapon-definition.ts`, wenn aus `FireProfile` / `visualKind` abgeleitet (`funnel-combat.mdc`).

---

## 2. Phase A — einheitlicher Impact-Burst ✅

**Ziel:** Alle Projektil-Impacts sehen erst mal **gleich** aus: kurze, expandierende, ausfadende **Kugel** in Waffenfarbe, Größe aus `impactRadius`.

| Parameter (`WeaponDefinition`) | VFX |
|--------------------------------|-----|
| `color` | Burst (+ aufgehellter Kern via Material) |
| `impactRadius` | End-Skala der Kugel (`BURST_END_SCALE_FACTOR`) |
| `visualKind` | nur Feintuning in Stufe B, keine eigenen Meshes in A |

| `ImpactBurstKind` | Verhalten |
|-------------------|-----------|
| `hit` | voller Burst — Final-Treffer, Build, normale Wand |
| `ricochet` | ~52 % Skala — Ripper-Kling an Wand, Projektil fliegt weiter |

**Modul:** `src/combat/projectile-impact-visual.ts`  
**Anbindung:** `weapon-arsenal.ts` → `#spawnImpact` / `#updateImpactBursts` (jeden Frame in `update`)  
**Hitscan:** kann dieselbe API nutzen (bereits vorbereitet in `hitscan-weapon.ts`).

Kein neues `WeaponDefinition`-Feld. Kein Point-Light pro Impact (Performance — vgl. `PROJECTILE_LIGHT_POOL_SIZE`).

### Konstanten (Modul)

| Konstante | Rolle |
|-----------|--------|
| `BURST_DURATION_MS` | 200 ms Animation |
| `BURST_END_SCALE_FACTOR` | × `impactRadius` Endgröße |
| `RICOCHET_BURST_SCALE_FACTOR` | 0.52 — kleinerer Kling |

---

## 3. Roadmap (später)

| Stufe | Inhalt | Neue Weapon-Felder? |
|-------|--------|---------------------|
| **A** ✅ | Expandierender Burst, alle Slots | nein |
| **B** | `visualKind`-Varianten — Funken (Ripper), Rauchring (Rocket), Splatter (Bio) | nein |
| **C** | Flak: Mini-Bursts / Shrapnel-Partikel | optional `childProjectiles` im ImpactProfile |
| **D** | Shock-Orb, Redeemer-Shockwave — eigene Entities | nicht in `WeaponDefinition` bloat |

**Audio Phase 3:** OGG pro `visualKind` kann Impact ergänzen; Presets modulieren Rate/Gain (`docs/audio.md`).

**Physik-Erweiterung:** Flak/Ripper-RMB Ricochet-Zähler in `weapon-arsenal`, gleiche `spawnProjectileImpactBurst({ kind })` API.

---

## 4. Ricochet-Regeln

```
Treffer Wand/Funnel (kein zerstörtes Build)
  └─ ripper && ricochetsRemaining > 0
        → reflect direction, surface nudge, Burst kind=ricochet, leiserer Impact-Sound, weiter
  └─ sonst
        → Burst kind=hit, Projektil entfernen

Treffer Build mit Schaden
  → Burst kind=hit (größer/lauter via IMPACT_GAIN_BUILD), kein Bounce
```

---

## 5. Abnahme Phase A (2026-05-22)

- [x] Jeder Treffer: expandierende Kugel (Waffenfarbe, ~`impactRadius`).
- [x] Ripper-Wand: Projektil fliegt weiter, kleinerer Burst.
- [x] Ripper Build: großer Burst, Projektil weg.
- [x] Optik als gute Ausgangsbasis (Playtest).
- [x] Impact-Sounds hörbar nach Gain-/Panner-Fix (`docs/audio.md`).
- [ ] Gatling-Dauerfeuer: FPS-Stabilität unter Last (48-Burst-Cap).

---

## 6. Referenzen

- `src/combat/weapon-arsenal.ts`, `projectile-visuals.ts`, `weapon-definitions.ts`
- `docs/audio.md`, `docs/introduction.md` §7, `docs/umsetzung.md` Phase 10
- `.cursor/rules/funnel-combat.mdc`, `.cursor/rules/funnel-performance.mdc`
