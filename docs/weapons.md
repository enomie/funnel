# FUNNEL — Waffen (Spieler-Arsenal)

Spec: `docs/introduction.md` §7 · Daten: `src/combat/weapon-definitions.ts` · Runtime: `weapon-arsenal.ts`.

Steuerung: **LMB** Primary, **RMB** Alt-Fire, **V / MMB** First Person. `FireTrigger`: Default **semi** (ein Schuss pro Klick); **auto** nur Gatling + Pulse.

**Gameplay-Schaden:** Treffer laufen über `apply-impact.ts` — zentraler `CombatImpactSink` in `WeaponArsenal` (Hitscan + `WorldProjectileSim`). Audio/VFX und Schaden teilen sich dieselbe Impact-Pipeline.

---

## Code-Map (Runtime)

| Modul | Rolle |
|-------|--------|
| `fire-intent.ts` | Input → `FireIntent` + `SecondaryHoldGates`; **einziger** Einstieg für `tryFire` vs. Hold-Secondary |
| `weapon-arsenal.ts` | Slot, Munition, Burst/Volley/Charge/Guided, `#impactSink`, Shock-Combo-Callback |
| `hitscan-weapon.ts` | LMB-Strahlen (Shock, Sniper, …); Orb-Test **vor** `world.castRay` |
| `world-projectile-sim.ts` | Projektile, Rapier-Ray-Steps, Ripper-Ricochet; Orb-Combo auch für **bewegliche** Bolts |
| `shock-combo.ts` | Ray–Kugel-Math (`findFirstShockOrbAlongRay`, `listShockOrbTargets`) |
| `rocket-launcher.ts` | 6er-Magazin, Mündungs-Ring, Mark-Hold |
| `bio-charge.ts` | RMB-Ladung + Preview an Mündung |
| `redeemer-guided.ts` | RMB Guided-Flug + Kamera-Scratch |

**Budgets:** `WEAPON_ARSENAL_PLAYER_BUDGET` (96 aktive Projektile) · `WEAPON_ARSENAL_BOT_BUDGET` (8) — Bots spammen nicht wie Menschen, CPU-Deckel bei vielen KI.

**Tick-Gating:** `needsWorldTick()` / `needsMechanicsAudioTick()` — Arsenal schläft, wenn nur gehalten wird (kein Burst, keine Salve, kein Beam, kein Guided). Loop ruft `tickWorld` / Audio nur bei Bedarf.

---

## Input-Routing (LMB / RMB)

Spieler (`funnel-app.ts`) und Bots (`bot-actor.ts`) nutzen dieselbe Kette:

1. `fillFireIntentFromInput` / `fillFireIntentFromBrain` → `FireIntent`
2. `fillSecondaryHoldFromInput` / `fillSecondaryHoldFromBrain` → Hold-Gates (pressed / held / released)
3. `applyPrimaryFireIntent` → `weapon.tryFire('primary', …)`
4. `applyCombinedSecondaryIntent` → verzweigt **vor** `tryFire('secondary')`:

| Waffe | RMB-Pfad |
|-------|----------|
| Bio (`9`) | `beginBioChargeHold` → `tickBioCharge` → `releaseBioCharge` |
| Rocket (`3`) | `beginRocketMarkHold` → `tickRocketMarking` → `releaseRocketVolley` |
| Sonst | `applySecondaryFireIntent` → `tryFire('secondary')` (+ `tickSecondaryBeamHold` für Pulse) |

`WeaponArsenal.tryFire('secondary')` gibt für Rocket/Bio **bewusst** `false` zurück — Hold-Mechanik hat kein Instant-Fire-Profil. `weaponUsesHoldSecondary()` markiert das in `fire-intent.ts` (inkl. Bot-Brain: Secondary-Hold statt Primary, wenn beides „Feuer“ will).

**Exklusivität:** Gleichzeitig LMB+RMB aktiv → Secondary-Gates werden geleert (`applyExclusiveFireIntent`), damit z. B. kein Shock-Orb während LMB-Beam startet.

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

1. **RMB** — Orb ins Feld schießen (kein Rapier-Collider am Orb, logisches Ziel `shock-orb`).
2. **LMB** — Strahl trifft Orb **vor** der Wand → **Combo-Detonation** statt normalem Beam-Treffer.
3. Alternativ: **beweglicher Bolt** (z. B. Ripper) trifft Orb unterwegs → gleiche Combo über Projektil-Step in `world-projectile-sim`.

**Technik:**

- Orbs: `WorldProjectileSim.listShockOrbs(ownerId?)` · Entfernen: `removeShockOrbWeapon(id)` → `WeaponDefinition` für `comboImpact`.
- LMB: `HitscanWeapon` testet `findFirstShockOrbAlongRay` gegen `#shockComboContext.orbs` **bevor** `world.castRay`; Treffer → `#resolveShockCombo` → Detonation + Orb-Removal.
- Projektil: `#findShockComboHit` im Ray-Step; näherer Treffer (Orb vs. Wand) gewinnt → Bridge `resolveShockCombo`.

| Profil | `directDamage` | `impactRadius` | Nutzung |
|--------|----------------|----------------|---------|
| `primaryImpact` | 48 | 0.28 | Wand/Ziel ohne Orb |
| `secondaryImpact` | 52 | 0.42 | Orb trifft Fläche allein |
| `comboImpact` | 96 | 0.78 | Beam/Bolt + Orb (größerer Burst + lauterer Impact) |

Orb-Tag: `shock-orb` in `FireProfile.projectileTags`. Trefferradius ≈ `0.34 × projectileScale × 1.1` m.

**Test:** Slot 2, RMB Orb, LMB auf Orb → großer Blitz, Orb verschwindet; LMB auf Wand ohne Orb → kleinerer Hit.

---

## Rocket Launcher (Slot `3`) ✅

**Magazin: 6 Raketen** (gemeinsamer Pool LMB + RMB). Reload später — bei 0 leer bis Waffenwechsel.

### LMB — Einzelfeuer, rotierende Mündung

- **semi** — ein Klick = eine Rakete aus der **nächsten** Mündung (Index 0→5→0…).
- Spawn-Offsets: Ring um Mündung (`rocket-launcher.ts`, `resolveRocketBarrelSpawn`).
- Nach 6 Schüssen: keine LMB-Raketen mehr (`#tryFireRocketPrimary`).

### RMB — Markieren, Release = Salve

| Phase | Input | Verhalten |
|-------|-------|-----------|
| **Halten** | `secondaryHeld` | Rakete alle ~280 ms markieren (max. Rest im Magazin) |
| **Loslassen** | `secondaryReleased` | N markierte Raketen mit leichtem Spread |

Kurzer RMB-Tap ohne Hold → **keine** Salve (erstes Mark-Intervall nicht erreicht).

**Technik:** `rocket-launcher.ts` (`RocketLauncherMagazine`); Routing über `applyCombinedSecondaryIntent` in `fire-intent.ts` — **nicht** `tryFire('secondary')`.

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

LMB blockiert während Hold (`#bioCharge.isHolding` → `tryFire` primary/secondary false). **Technik:** `bio-charge.ts`, `bioChargeSecondary: true`; `chargeMinMs` / `chargeMaxMs` / `chargeMinScale` in `FireProfile.secondary`. Routing: `applyCombinedSecondaryIntent`.

**Noch offen:** Split in kleinere Puddles beim Impact (`childProjectiles`).

---

## Redeemer Seed (Slot `0`) ✅

| Modus | Input | Verhalten |
|-------|-------|-----------|
| **LMB** | semi | Langsame Mini-Nuke geradeaus (speed 22) — expandierende Kill-Kugel **50 m** über **3 s** (`expandingLethal`; VFX = Kill-Radius, weglaufbar) |
| **RMB** | semi | **Guided** Seed (speed 28) — gleicher Detonation-Impact wie LMB |

Während Guided: kein Feuern, kein Movement (`setMovementLocked`), Kamera-Override hinter Rakete (`redeemer-guided.ts`, Tag `redeemer-guided`). Max. Flugzeit 14 s → Detonation. Waffenwechsel beendet Guided-Tracking (Projektil fliegt weiter); `suspendCombat` räumt Hold/Burst auf.

---

## Weitere Slots (Kurz)

| Slot | Hinweis |
|------|---------|
| `1` Pistol | `#burstShotsRemaining`; Burst nur solange `selectedWeapon.slotLabel` unverändert; `selectSlot` → `#clearPistolBurst()` |
| `4` Ripper | Ricochet nur wenn `ricochetMax` > 0; RMB größere Disk; kann Shock-Orbs combo-triggern |
| `6` Sniper | RMB nur `sniperZoomFovScale` 0.38, kein `tryFire` |
| `7` Gatling | `trigger: auto` beide Modi |
| `8` Pulse | RMB `beamTick` + `beam-stream-visual.ts`; `releaseBeamStream` bei RMB los |

Implementierungsdetails und Phasen: `docs/umsetzung.md`.
