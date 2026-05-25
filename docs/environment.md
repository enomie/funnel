# Environment — Spawn & Look

Design-Notizen für alles, was die Arena **füllt** und **ausstrahlt**: Geometrie, Cover, Licht, Material, Pickups, Bots — getrennt von Waffen/Spieler-Logik. Architektur-Überblick bleibt in [`introduction.md`](introduction.md) §5–6 und §9.

**Code heute:** `src/arena/funnel-arena.ts`, `funnel-zones.ts` (nur `FunnelZoneId`), `ceiling-fixtures.ts`, `environment-cube.ts`, `spawn-shield-*.ts`, `neutral-*.ts`, **`src/render/materials/grid-tsl.ts`**, **`environment-grid-material.ts`**, `src/render/create-scene.ts`, Spawns `src/combat/teams.ts` + `src/combat/match-roster.ts`, Spieler `PLAYER_CONFIG.spawn` in `src/config/game-config.ts`.

**Stand:** **Statische Arena-Geometrie** (Shell, TSL-Grid, Cover, Podest, Deckenleuchten) ist für den ersten Pass **fertig** — Feintuning jederzeit möglich. **Nächster Fokus:** dynamische / zerstörbare Objekte → [`environment-dynamic.md`](environment-dynamic.md).

---

## Ist-Zustand (Stand Code)

### Raum

| Parameter | Wert |
|-----------|------|
| Funnel | **50 × 300 × 50 m** (`FUNNEL_DIMENSIONS`) |
| Zonen | 3 × 100 m: **alpha** (N, `z ≈ -150…-50`), **neutral**, **beta** (S, `z ≈ 50…150`) |
| Team-Spawns | Pocket (Respawn) **15 m** am Bulkhead · Match-Start-Drop **15 m** ab **30 m** vom Ende — dazwischen **15 m** Schutzwürfel |
| Spieler-Default | `beta`, Start `(0, 1.75, 142.5)` — heute noch Pocket, siehe § Spawn-Logik |

### Was beim Level-Start gespawnt wird (statisch)

| Element | Anzahl / Platzierung | Physik | Look |
|---------|----------------------|--------|------|
| Shell | Boden/Decke/Wände je **3 Zonen-Segmente** + Nord/Süd-Bulkheads | Rapier fixed cuboids (unsichtbar) | **`zoneGridMaterial(zone)`** — TSL-Grid + `GRID_BASE_COLOR` `0x141b24` |
| Zone-Grids | **Im Material** (keine `LineSegments`) | — | 1 m dünn / 5 m dick, emissive Linien, Teamfarben alpha/neutral/beta |
| Deckenleuchten | **~108** Troffer (4 Spalten × ~9 Reihen × 3 Zonen) | nur Mesh, **kein Collider** | TSL-Grid + zone-emissive Unterseite; **`castShadow: false`** |
| Spawn-Schutzwürfel | 20 × 5³ m (2×5 alpha, 2×5 beta, versetzt) | Rapier **fixed** | `zoneGridMaterial` (`spawn-shield-cubes.ts`) |
| Spawn-Überdachung | 2 × 50×45×30 m (alpha / beta) | Rapier **fixed** | `zoneGridMaterial` (`spawn-shield-canopy.ts`) |
| Neutrale Eck-Würfel | 4 × 5³ m (Ecken neutraler Zone) | Rapier **fixed** | `zoneGridMaterial('neutral')` |
| Neutral-Podest | Sockel 20×1×20 + Top 10×1×10 + Redeemer 1³ m (5-m-Raster) | Rapier **fixed** | `zoneGridMaterial('neutral')` |
| Szene-Licht | Ambient + **Directional Key** (Schatten, folgt Spieler) + Point Mitte + **Lichtkugel** (Fight-Focus) | — | Fog `70–230`, BG `0x050607`; `lighting.updateShadowFocus` + `updateFightFocus` in `funnel-app.ts` |
| Dev-Bots | **14 Verbündete + 15 Gegner** (Pro **15v15**) | — | Y-Bot / Humanoid-Roster, teamfarben |

**Noch nicht im Arena-Code:** dynamische/zerstörbare Props, Pickups (Redeemer-Anker existiert), Build-Editor-Geometrie, instanzierte Säulen, `environment-physics-material.ts`, Audio-Material-Tags.

**Später evtl. statisch:** weitere Cover-Props, Säulen, Flanken-Deko — gleiche Regeln (TSL-Grid, 5-m-Raster).

### Bots & Spieler — Spawn-Logik (Match-Start vs. Tod-Respawn)

Pro Team-Ende (**Bulkhead** bei `z = ±150`) drei **aneinanderliegende 15-m-Bänder** entlang Z — von der Wand zur Mitte:

```
Bulkhead          Schutzwürfel              Match-Start-Drop        Arena
(end)             (2×5 × 5³)                (Intro, Countdown)
│◄── 15 m ──►│◄── 15 m ──►│◄── 15 m ──►│
  Respawn         Boxen-Reihen              Luft-Fall
  Pocket          front ±122.5              vor den Boxen
                  rear  ±132.5
```

| Band | Abstand vom Bulkhead | Alpha (N) `z` | Beta (S) `z` | Nutzung |
|------|----------------------|---------------|--------------|---------|
| **Spawn-Pocket** | **0…15 m** | `−150 … −135` | `+135 … +150` | **Tod-Respawn**, Dev-Flip, Revive-Fallback — Boden-Teleport |
| **Schutzwürfel** | **15…30 m** | `−135 … −120` | `+120 … +135` | Statische Cover-Reihen (Front `±122.5`, Rear `±132.5`) — **kein** Actor-Spawn |
| **Match-Start-Drop** | **30…45 m** | `−120 … −105` | `+105 … +120` | **Countdown 10→0** — Luft-Spawn + Fall, Input gesperrt; X in Gaps (`spawnShieldGapCentersX`) |

Beide Spawn-Zonen sind **je 15 m tief**; der Match-Start-Bereich beginnt erst **30 m vom Bulkhead** (45 m vom Ende der 300-m-Länge), weil **dazwischen** (15…30 m) die Schutzwürfel stehen.

| Phase | Z-Band | Wie | Code |
|-------|--------|-----|------|
| **Match-Start** | 30…45 m vom Bulkhead (`±105…±120`) | Luft-Spawn, **herunterfallen** während Countdown; Spieler + Roster | `matchStartDropExtentZ()` / `matchStartSpawnSlots()` — **geplant** |
| **Tod-Respawn** | 0…15 m vom Bulkhead (`±135…±150`) | Teleport auf Boden, volle Health — **kein** Intro-Drop | `teamSpawnPocketExtentZ()` · `spawnPocketZ()` · `respawnAtFaction()` — **Ist** |

**Warum Intro-Drop:** Beim Match-Start fallen Fraktionen **vor** den Boxen ins Band `±105…±120` — sichtbar für alle, parallel Rain/Pickups. Tod-Respawn bleibt **immer** im geschützten Pocket am Bulkhead.

**Ist-Stand Code:** Match-Start-Drop live (`playerMatchStartDropPosition`, `beginMatchStartDrop`, `devPlaceholderSpawnPairs`); Tod-Respawn unverändert im Pocket (`playerFactionSpawnPosition`, `respawnAtFaction`).

- Roster: **14 Verbündete + 15 Gegner** (`match-roster.ts`; `playersPerTeam: 15`).
- Spieler-Fraktion: `playerTeam.assign(…, 'spawn')` beim Laden — später auf Match-Start-Drop umstellen.

---

## Grid & Material (TSL — ein System)

**Regel:** Keine `LineSegments`-Overlays mehr. Das Raster sitzt **im Fragment-Shader** (`grid-tsl.ts`) über **`positionWorld`** — Weltkoordinaten, 1 m / 5 m an ganzzahligen Metern (`0, 1, 5, 10 …`).

| Modul | Rolle |
|-------|--------|
| `grid-tsl.ts` | `buildWorldGridColorNode`, `buildWorldGridEmissiveNode`, Konstante **`GRID_BASE_COLOR`** |
| `environment-grid-material.ts` | `zoneGridMaterial('alpha' \| 'neutral' \| 'beta')` — gecachtes `MeshStandardNodeMaterial` |

| Raster | Wert (Code) |
|--------|-------------|
| Minor | **1 m**, dünne Linie, diffuse + emissive |
| Major | **5 m**, dickere Linie, diffuse + emissive |
| Fläche zwischen Linien | **`GRID_BASE_COLOR`** (`0x141b24`, dunkles Blaugrau) |
| Emissive Linien | `GRID_EMISSIVE_STRENGTH` (Feintuning in `grid-tsl.ts`) |
| Zonen-Linienfarbe | alpha → `TEAM_BASE_HEX.enemy` · neutral → `0x7b7b7b` · beta → `TEAM_BASE_HEX.ally` |

**Nutzung:** Shell-Segmente, alle `environment-cube`-Boxen, Deckenleuchten-Gehäuse (5 Flächen); Leuchten-Unterseite = separates emissives `MeshStandardMaterial`.

**Entfernt:** `environment-cube-grid.ts`, `createFunnelZoneGrids`, `ENVIRONMENT_SURFACE_MATERIAL`.

---

## Vision — Look & Stimmung

### Einheitliche Oberfläche

| Aspekt | Vorgabe / Ist |
|--------|----------------|
| Farbe | Dunkles Blaugrau **`GRID_BASE_COLOR`** + zone-farbige Grid-Linien |
| Variation | Unterscheidung über **Grid-Linienfarbe**, nicht unterschiedliche Wand-Albedos |
| Shell | Pro Zone einheitlich mit Props (`zoneGridMaterial`) — **done** |

### Grid überall gleiches Raster — nur Linienfarbe variiert

| Kontext | Grid-Linienfarbe |
|---------|------------------|
| Zone **alpha** | `TEAM_BASE_HEX.enemy` |
| Zone **neutral** | `0x7b7b7b` |
| Zone **beta** | `TEAM_BASE_HEX.ally` |
| **Deckenleuchten** | Gehäuse: zone-Grid · **Unterseite:** emissive (kein TSL-Grid) |

**Nicht:** Emissive als Ersatz für Grid auf Körperflächen (Ausnahme: Leuchten-Unterseite).

### Beleuchtung & Schatten

| Quelle | Verhalten |
|--------|-----------|
| **Directional Key** | Hauptlicht von oben, **einzige Shadow-Map**, folgt Spieler (`SHADOW_FOCUS_HALF_M` ≈ 44 m) |
| **Point Mitte + Lichtkugel** | Orb + `PointLight` bei `y = height − 1`, `z = 0`; **Fight-Focus:** Fraktionsfarbe wenn eine Heimat mehr Eindringlinge hat (`intrusion-pressure.ts` → `lighting.updateFightFocus`) — siehe `game-mechanics.md` |
| **Deckenleuchten** | Emissive Panel + **kein** `castShadow` (keine Bodenstreifen) |
| **Character/Bots** | `castShadow: true`, Boden `receiveShadow: true` |

Feintuning: Konstanten in `create-scene.ts` + `create-renderer.ts` (`toneMappingExposure`).

### Noch offen (Look)

**Lesbarkeit im Kampf:** Silhouetten vs. einheitliche graublaue Flächen; Zonen über Grid-Farbe + Decken-Glow.

---

## Vision — Physik & Masse (ein Environment-Material)

**Regel:** Für alle Environment-Teile (Shell-Props, Cover, Build-Pieces, dynamische Brocken) gibt es **genau ein** Rapier-Material-Preset — **keine** Preset-Familie wie in `introduction.md` (Concrete / Metal / Wood / Grass) für den Tunnel-Inhalt. Unterschiedliche „Schwere“ entsteht **nur** aus der **Geometrie**, nicht aus unterschiedlicher Dichte pro Objekttyp.

| Aspekt | Vorgabe |
|--------|---------|
| **Dichte** | Eine globale `density` (kg/m³), mittig: **schwerer als Holz/Kunststoff, leichter als Beton/Stahl** |
| **Reibung / Restitution** | Gleiche Werte für alle dynamischen Environment-Collider |
| **Masse pro Teil** | **Nur aus Maßen:** Volumen × `density` |
| **Statisch vs. dynamisch** | Shell bleibt `fixed`. Beweglich/zerstörbar: dynamic + gemeinsame `density` |

**Implementierung (Ziel):** z. B. `src/arena/environment-physics-material.ts` — `ENVIRONMENT_PHYSICS_DENSITY` (+ friction/restitution).

**Offen:** konkreter `density`-Wert beim ersten Rapier-Tuning-Pass.

---

## Vision — Was spawnen wir wo?

### Mitte (neutral, ~100 m)

#### Eck-Würfel (4× statisch)

**Pro neutrale Zone:** **4 Würfel** an den **Ecken**, **5×5×5 m**, Rapier `fixed`.

| Ecke | Position (Center) |
|------|-------------------|
| Nord-West | `(-22.5, 2.5, -47.5)` |
| Nord-Ost | `(22.5, 2.5, -47.5)` |
| Süd-West | `(-22.5, 2.5, 47.5)` |
| Süd-Ost | `(22.5, 2.5, 47.5)` |

Code: `neutral-corner-cubes.ts`.

#### Podest (Mitte)

| Stufe | Maße | Center | Footprint X/Z |
|-------|------|--------|---------------|
| Sockel | **20 × 1 × 20 m** | `(0, 0.5, 0)` | `−10 … +10` |
| Top | **10 × 1 × 10 m** | `(0, 1.5, 0)` | `−5 … +5` |
| Redeemer-Spawn | **1³ m** | `(0, 2.5, 0)` | Mitte |

Code: `neutral-podium.ts` · `REDEEMER_SPAWN_POSITION`.

#### Deckenleuchten (Troffer)

| Eigenschaft | Wert |
|-------------|------|
| Maße | **2 × 5 × 10 m** (Breite × Tiefe × Länge entlang Z) |
| Abstand entlang Z | **10 m** Panel + **2 m** Lücke → Mittelpunkte alle **12 m** |
| Spalten X | **−20, −10, 10, 20** (Mitte **x = 0** frei — Podest/Redeemer) |
| Center Y | **47.5** |
| Physik | kein Collider |
| Look | `zoneGridMaterial` (5 Flächen) + emissive Unterseite |
| Schatten | **`castShadow: false`** |

Pro Zone ~**9 Reihen × 4 Spalten ≈ 36** → **~108** gesamt. Kein PointLight pro Fixture.

Code: `ceiling-fixtures.ts`.

### Team-Enden (alpha / beta)

#### Spawn-Schutzwürfel

**Pro Fraktion:** **2 Reihen × 5 Würfel** — vordere Reihe + versetzte hintere Reihe.

| Eigenschaft | Vorgabe |
|-------------|---------|
| Maße | **5³ m** |
| Reihen Z | Front `±122.5` · Rear `±132.5` — liegen im **15-m-Boxenband** (15…30 m vom Bulkhead, `z ±120…±135`) |
| Physik / Look | `fixed`, `zoneGridMaterial(alpha/beta)` |

**Spawn-Pocket** (Respawn): Alpha `−150…−135` · Beta `+135…+150` — **0…15 m** vom Bulkhead.

**Match-Start-Drop** (Intro): Alpha `−120…−105` · Beta `+105…+120` — **30…45 m** vom Bulkhead, **vor** den Boxen.

Code: `spawn-shield-cubes.ts`.

#### Überdachung

**50 × 45 × 30 m** pro Seite, `zoneGridMaterial` teamfarben.

Code: `spawn-shield-canopy.ts`.

**Gesamt statisch:** 20 Schutzwürfel + 2 Überdachungen + 4 Eck-Würfel + Podest + ~108 Deckenleuchten + Shell.

---

## Dynamisches & Zerstörbares

Vollständige Planung: **[`environment-dynamic.md`](environment-dynamic.md)**.

Kurz: noch **kein Code**; `dynamicBodies` leer; dynamisches Orange-Grid später eigene TSL-Preset-Variante.

---

## Spawn-Matrix (Zielbild)

| Kategorie | Wo | Häufigkeit | Physik | Priorität |
|-----------|-----|------------|--------|-----------|
| Spawn-Schutzwürfel | alpha + beta | 20 × 5³ m | fixed | **done** |
| Neutrale Eck-Würfel | neutral Ecken | 4 × 5³ m | fixed | **done** |
| Neutral-Podest + Redeemer | `(0,0,0)` | 1 + 1³ m | fixed | **done** |
| Deckenleuchten | 4 Spalten, Z alle 12 m | ~**108** | none | **done** |
| Dynamisches Cover | Rain | siehe dynamic doc | dynamic | **next** |
| Pickups | TBD | TBD | — | **next** |

---

## Offene Fragen

- [ ] Feintuning Licht/Schatten (`create-scene.ts`, Grid-Emissive in `grid-tsl.ts`)
- [ ] Dynamisches Cover — [`environment-dynamic.md`](environment-dynamic.md)
- [ ] Feintuning Abstände / 10-Spieler-Spawn-Grid im Pocket (Respawn)

---

## Changelog (Notizen)

| Datum | Notiz |
|-------|-------|
| 2026-05-23 | Doc angelegt; Ist-Zustand aus Code |
| 2026-05-23 | Look: einheitliches Graublau + 1 m/5 m-Grid |
| 2026-05-23 | Spawn-Schutzwürfel, Eck-Würfel, Podest, Überdachung, Deckenleuchten |
| 2026-05-23 | Statischer Pass abgeschlossen; dynamisch → `environment-dynamic.md` |
| 2026-05-23 | **TSL-Grid:** `grid-tsl.ts` + `zoneGridMaterial`; LineSegments/`environment-cube-grid` entfernt |
| 2026-05-23 | Shell: Zonen-Segmente mit TSL; `GRID_BASE_COLOR` `0x141b24`; Weltraster an ganzzahligen Metern |
| 2026-05-23 | Licht: Directional Key + player-shadow; Leuchten `castShadow: false`; Mitte-Spalte Leuchten entfernt (4× statt 5×) |
| 2026-05-24 | Spawn-Spec: drei 15-m-Bänder (Pocket · Boxen · Match-Start-Drop ab 30 m vom Bulkhead) |
