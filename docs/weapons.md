# FUNNEL — Waffen (Spieler-Arsenal)

Spec: `docs/introduction.md` §7, Implementierung: `src/combat/weapon-definitions.ts`, Runtime: `weapon-arsenal.ts`.

Steuerung: **LMB** Primary, **RMB** Alt-Fire, **V / MMB** First Person. `FireTrigger`: Default **semi** (ein Schuss pro Klick); **auto** nur Gatling + Pulse.

**Gameplay-Schaden:** Impacts sind Audio/VFX — kein `applyImpact` auf Spieler/Build (später).

---

## Übersicht (Slots `1`–`0`)

| Slot | Waffe | LMB | RMB |
|------|--------|-----|-----|
| `1` | Pistol | präziser Semi | 3er-Burst (`secondaryPressed`) |
| `2` | Shock Blaster | Hitscan-Beam | Shock-Orb + **Combo** (LMB auf Orb) |
| `3` | Rocket Launcher | 6er-Magazin, rotierende Mündung | Hold markieren → **Release** Salve |
| `4` | Ripper | Ricochet-Disk ×3 | Explosive Disk ×3 Bounce |
| `5` | Flak Cannon | 9× Schrapnell-Kegel | Ballistische Granate → 4 Splitter |
| `6` | Sniper | Hitscan | Zoom (`secondaryHeld`, kein Schuss) |
| `7` | Gatling | Auto, eng | Auto, max. Spread |
| `8` | Pulse Lance | Auto-Bolts | Beam-Stream (`beamTick`) |
| `9` | Bio Lobber | kleine Sticky-Clumps | **Charge** am Mündung → Release Blob |
| `0` | Redeemer | langsame Mini-Nuke | **Guided** Nuke (Kamera folgt) |

Details unten für Signature-Waffen. Vollständiger Implementierungsplan: `docs/umsetzung.md`.

---

## Shock Blaster (Slot `2`)

| Modus | Input | Delivery | Verhalten |
|-------|-------|----------|-----------|
| **LMB** | semi | `hitscan` | Energie-Strahl (Ray ab Muzzle, Reichweite 220 m) |
| **RMB** | semi | `projectile` | Langsame Plasma-Kugel (`shock-orb`, 16 m/s, größere Sphere) |

### Combo (UT99)

1. **RMB** — Orb ins Feld schießen (kein Rapier-Collider, nur logisches Ziel).
2. **LMB** — Strahl trifft Orb **vor** der Wand → **Combo-Detonation** statt normalem Beam-Treffer.

**Technik:** `shock-combo.ts` testet Ray–Kugel gegen alle aktiven Orbs in `weapon-arsenal` **bevor** `world.castRay`. Nächster Treffer entlang des Strahls gewinnt.

| Profil | `directDamage` | `impactRadius` | Nutzung |
|--------|----------------|----------------|---------|
| `primaryImpact` | 48 | 0.28 | Wand/Ziel ohne Orb |
| `secondaryImpact` | 52 | 0.42 | Orb trifft Fläche allein |
| `comboImpact` | 96 | 0.78 | Beam + Orb (größerer Burst + lauterer Impact) |

Orb-Tag: `shock-orb` in `FireProfile.projectileTags`. Trefferradius ≈ `0.34 × projectileScale × 1.1` m.

**Test:** Slot 2, RMB Orb, LMB auf Orb → großer Blitz, Orb verschwindet; LMB auf Wand ohne Orb → kleinerer Hit.

---

## Rocket Launcher (Slot `3`) ✅

**Magazin: 6 Raketen** (gemeinsamer Pool LMB + RMB). Reload später — bei 0 leer bis Waffenwechsel.

### LMB — Einzelfeuer, rotierende Mündung

- **semi** — ein Klick = eine Rakete aus der **nächsten** Mündung (Index 0→5→0…).
- Spawn-Offsets: Ring um Mündung (`rocket-launcher.ts`, `resolveRocketBarrelSpawn`).
- Nach 6 Schüssen: keine LMB-Raketen mehr.

### RMB — Markieren, Release = Salve

| Phase | Input | Verhalten |
|-------|-------|-----------|
| **Halten** | `secondaryHeld` | Rakete alle ~280 ms markieren (max. Rest im Magazin) |
| **Loslassen** | `secondaryReleased` | N markierte Raketen mit leichtem Spread |

Kurzer RMB-Tap ohne Hold → **keine** Salve (erstes Mark-Intervall nicht erreicht).

**Technik:** `rocket-launcher.ts` (`RocketLauncherMagazine`); `funnel-app` ruft `beginRocketMarkHold` / `tickRocketMarking` / `releaseRocketVolley` — kein `tryFire('secondary')`.

---

## Flak Cannon (Slot `5`) — RMB-Granate

- **LMB:** 9× Schrapnell, enger Kegel.
- **RMB:** Eine ballistische Granate (`lobUpBias` 0.42, speed 38) → beim Aufprall **4 Splitter** (`childShrapnel*`, `createLowShrapnelDirections`).
- Splitter-Reichweite/Cap: `childShrapnelMaxRangeM` 4.2 m · **Kill-Radius + Impact-VFX** LMB/RMB/Splitter **2 m** (`FLAK_KILL_RADIUS_M`, `lethalSplash`, expandierende Kugel beim Auftreffen).

---

## Bio Lobber (Slot `9`) ✅

| Modus | Input | Verhalten |
|-------|-------|-----------|
| **LMB** | semi | Kleine Sticky-Clumps (`projectileScale` 0.5), ballistic, `stickDelayMs` 2600 |
| **RMB** | Hold + **Release** | Blob wächst an der **Mündung**, Loslassen = ein geladener Lob |

### RMB Charge

| Phase | Verhalten |
|-------|-----------|
| **Halten** | Preview-Sphere an Mündung; wächst von ~52 % auf 100 % Max-Scale (160 ms–1200 ms) |
| **Loslassen** | Ein Projektil — Schaden, `impactRadius`, `stickDelayMs` skaliert mit Ladung |
| **Kurzer Tap** | Minimum-Ladung (~52 % Max) |

LMB blockiert während Hold. **Technik:** `bio-charge.ts`, `bioChargeSecondary: true`; `chargeMinMs` / `chargeMaxMs` / `chargeMinScale` in `FireProfile.secondary`.

**Noch offen:** Split in kleinere Puddles beim Impact (`childProjectiles`) — mit `applyImpact` später.

---

## Redeemer Seed (Slot `0`) ✅

| Modus | Input | Verhalten |
|-------|-------|-----------|
| **LMB** | semi | Langsame Mini-Nuke geradeaus (speed 22, großer Impact-Radius 0.58 m) |
| **RMB** | semi | **Guided** Seed — Kamera folgt Projektil, Maus lenkt, Spieler steht still |

Während Guided: kein Feuern, kein Movement (`setMovementLocked`), Kamera-Override hinter Rakete (`redeemer-guided.ts`, Tag `redeemer-guided`). Max. Flugzeit 14 s → Detonation. Waffenwechsel beendet Guided-Tracking (Projektil fliegt weiter).

---

## Weitere Slots (Kurz)

| Slot | Hinweis |
|------|---------|
| `1` Pistol | `#burstShotsRemaining`, eigener Secondary-Cooldown |
| `4` Ripper | Ricochet nur wenn `ricochetMax` > 0; RMB größere Disk, pink |
| `6` Sniper | RMB nur `sniperZoomFovScale` 0.38, kein `tryFire` |
| `7` Gatling | `trigger: auto` beide Modi |
| `8` Pulse | RMB `beamTick` + `beam-stream-visual.ts`; `releaseBeamStream` bei RMB los |

Implementierungsdetails und Phasen: `docs/umsetzung.md`.
