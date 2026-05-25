# FUNNEL — Interface UI (Match HUD)

Spec für **In-Match-HUD** und zugehörige Runtime-Module. DOM-Wurzel: `createAppDom()` / `.funnel-hud` in `src/app/dom.ts`; Wiring: `src/app/funnel-app.ts`.

**Referenz:** `docs/weapons.md`, `docs/introduction.md` §7, `docs/team-design.md`, geplant: `docs/revive-hire.md` (Revive/Hire-Channel-Panel).

---

## 0. HUD-Landschaft (Ist)

| Zone | Modul | Position (CSS) | Status |
|------|--------|----------------|--------|
| Team-Scoreboard | `team-hud.ts` | oben mitte (`top: 16px`) | ✅ members + kills + points |
| Health + Shield | `health-hud.ts` | unter Scoreboard (`top: 72px`) | ✅ |
| Crosshair | `crosshair-hud.ts` | Viewport-Mitte | ✅ |
| Munition + Reload | `ammo-hud.ts` | unten mitte (`bottom: 20px`) | ✅ |
| Steuerung-Hilfe | — | oben links `.funnel-panel` | ✅ |
| Status-Toast | `status-toast.ts` | unten (`funnel-status`) | ✅ |
| Pre-Match / Countdown | `match-flow-screen.ts` | Vollbild über Shell | ✅ |
| Death / Auto-Respawn | `death-respawn-hud.ts` | Vollbild über Shell (`z-index: 30`) | ✅ WASTED + 5…1 |
| Revive/Hire-Channel | — | geplant | ⬜ `docs/revive-hire.md` §5 |

Während **`data-aiming='true'`** (FP-Zielmodus): Crosshair sichtbar; Ammo-HUD ausgeblendet (`style.css`).

---

## 1. Team-Scoreboard (oben mitte) ✅

Zwei Badges nebeneinander — **Own** (viewer-Fraktion) und **Enemy** (`oppositeFaction`). Fraktions-Label neutral (Team Alpha / Team Beta); Farben viewer-relativ (Own blau, Enemy rot).

### 1.1 Layout pro Badge

Vertikal gestapelt (`.funnel-team-badge`):

| Zeile | DOM | Inhalt |
|-------|-----|--------|
| 1 | `.funnel-team-badge__label` | Fraktionsname (`TEAM_DEFINITIONS`) |
| 2 | `.funnel-team-badge__members` | Lebende Mitglieder — Zahl + CSS-Suffix **` members`** |
| 3 | `.funnel-team-badge__kills` | Team-Kills — Zahl + CSS-Suffix **` kills`** |
| 4 | `.funnel-team-badge__points` | Team-Punkte — **`000 Points`** (§1.4) |

`aria-label`: „Team members“ / „Team kills“ / „Team points“ auf den jeweiligen Spans.

### 1.2 Mitgliederzahl — Regeln

- Quelle: `countTeamRosterMembers(actorRegistry)` in `src/combat/team-roster-count.ts`.
- Zählt **lebende** Combat-Actors (`!health.isDead`) pro Fraktion (`alpha` / `beta`).
- Tote zählen nicht (Vorbereitung Revive/Hire — `docs/revive-hire.md` §7).
- Own-Badge = `viewerFaction`; Enemy-Badge = Gegner-Fraktion.

### 1.3 Kills ✅

- Quelle: `TeamKillScore.killsBy(faction)` — nur Cross-Fraktion-Kills aus `actor-died`-Events.
- Anzeige: Zahl + Suffix **` kills`** (CSS `::after`, analog `members`).

### 1.4 Team-Punkte & Match-Ende ✅

Vierte Zeile pro Badge: **Punktestand** des Teams (Kills + Feindgebiet-Präsenz — siehe `docs/game-mechanics.md`).

| Eigenschaft | Wert |
|-------------|------|
| **Format** | **`000 Points`** — dreistellig **zero-padded**, tabular-nums, Suffix **` Points`** (Stil wie `members` / `kills`) |
| **Quelle** | `TeamMatchPoints.formatDisplayPoints(faction)` — Kills (`recordCrossFactionKill`) + Präsenz (`recordPresenceSecond`, 1 Hz via `team-presence-scoring.ts`) |
| **Anzeige-Obergrenze** | **999** — UI zeigt maximal `999 Points` |
| **Match-Ende** | Sobald ein Team **1000 Punkte** erreicht → **Match vorbei** (`matchLive = false`) |
| **Sieg-Feedback** | Badge des **Gewinnerteams** leuchtet auf (`data-winner="true"`, Glow in `style.css`) |
| **Nach Sieg** | Toast mit Sieger-Label; Bewegung gesperrt — Endscreen später (`match-flow-screen.ts`) |

**Layout:**

```
Team Alpha
3 members
12 kills
042 Points
```

**Gleichstand bei 1000:** erster Kill oder Präsenz-Tick gewinnt (Integer-Ticks).

**Implementierung:** `TeamMatchPoints`, `team-hud.ts` + `.funnel-team-badge__points`, `data-winner` auf `.funnel-team-badge`.

### 1.5 Update

- `TeamHud.update(viewerFaction, scores, roster, points)` in `src/ui/team-hud.ts`.
- `refreshTeamHud()` in `funnel-app.ts`: jeden Frame bei `matchLive`, zusätzlich bei Kill und Dev-`T`-Flip.

### 1.6 Dateien

`dom.ts`, `style.css`, `team-roster-count.ts`, `team-match-points.ts`, `team-presence-scoring.ts`, `team-hud.ts`, `funnel-app.ts`.

---

## 2. Health & Shield (Mitte oben) ✅

| Element | Verhalten |
|---------|-----------|
| Label | `HP n · SH n` oder **`DEAD`** |
| Shield-Balken | oben, schmaler Track |
| Health-Balken | unten; `data-low`, `data-regen`, `data-dead` auf Root |
| Modul | `health-hud.ts` — `update(health, max, shield, max, isDead, isRegenerating)` |

Nur sichtbar/aktualisiert bei `matchLive` (`funnel-app.ts`).

---

## 3. Crosshair ✅

- Vier Linien-Ecken (`.funnel-crosshair__line--tl/tr/bl/br`); sichtbar bei `data-aiming='true'`.
- `CrosshairHud.flashHit()` — kurzer roter Flash bei Treffer des lokalen Spielers (`actor-damaged`).

---

## 4. Munitions-HUD (unten mitte)

Spec für **Ammo-/Reload-Runtime**. Waffen-Daten: `weapon-definitions.ts`, Feuerlogik: `weapon-arsenal.ts`.

### 4.1 Layout

Zwei horizontale **Balken übereinander**, fest am Viewport:

| Balken | Rolle | Darstellung |
|--------|--------|-------------|
| **Oben — Magazin** | Verbleibende **Projektile** im Pool (max. = Magazingröße) | Pro Slot ein **Quadrat** (10×10 px, feste Höhe): `filled` = Waffenfarbe, `reserved` = dunkler (RMB-Markierung / Bio-Vorschau), `chambering` = dunkler (Kammerladen), `empty` = grau |
| **Unten — Reload** | Nachladen (Magazin leer / perShot) | Füllbalken (6 px, 300 px breit), **permanent eingeblendet** |

**Position:** unten **mittig** (`left: 50%`, `translateX(-50%)`, `bottom: 20px`); Panel **300 px** breit; Reload-Balken **immer sichtbar** (leer = 0 % Füllung).

**Redeemer (`0`):** 1 □, **14 s** Reload nach jedem Schuss (LMB/RMB).

### 4.2 Verhalten (gemeinsam)

#### Munitionsmodell

- **`ammoMax`:** Anzahl Quadrate oben (physische „Projektile“ im Pool).
- **`ammoCurrent`:** gefüllte Quadrate von links; leere von `ammoCurrent` bis `ammoMax-1`.
- **Verbrauch:** beim erfolgreichen `tryFire` / Commit (nicht bei blockiertem Cooldown).
- **Nachladen:** startet **automatisch**, wenn der Pool für den Feuermodus **nicht mehr schießen kann**.
- **Waffenwechsel:** volles Magazin der neuen Waffe, Reload = 0.

#### UI-Update

- `src/ui/ammo-hud.ts`: `update(snapshot: AmmoHudSnapshot)`.
- Snapshot aus `WeaponArsenal.getAmmoHudSnapshot()` / `AmmoController`.
- DOM: `.funnel-ammo`, `.funnel-ammo__mag`, `.funnel-ammo__reload`.

#### Datenmodell

```ts
export type AmmoReloadKind =
  | 'perShot'
  | 'onEmpty'
  | 'boltAction'
  | 'beamOverheat';

export interface AmmoProfile {
  ammoMax: number;
  reloadMs: number;
  reloadKind: AmmoReloadKind;
  betweenShotReloadMs?: number;
  secondaryAmmoCost?: number;
  secondaryBurstAmmoCost?: number;
  beamMaxHoldMs?: number;
}
```

`WeaponDefinition.ammo?: AmmoProfile` — fehlt bei Redeemer.

---

## 5. Waffen — Magazin, Reload, UI-Sonderfälle

| Slot | Waffe | `ammoMax` (□ oben) | Verbrauch | Reload unten | `reloadMs` | Anmerkung |
|------|--------|-------------------|-----------|--------------|------------|-----------|
| `1` | Pistol | **12** | LMB: **1**; RMB-Burst: **3** | `onEmpty` | **700** | |
| `2` | Shock Blaster | **15** | LMB/RMB: **1** | `onEmpty` | **1000** | |
| `3` | Rocket Launcher | **6** | LMB: **1**; RMB: **1** pro Rakete | `onEmpty` | **3000** | |
| `4` | Ripper | **6** | LMB: **1**; RMB: **2** | `onEmpty` | **2000** | |
| `5` | Flak Cannon | **8** | LMB/RMB: **1** pro Abzug | `onEmpty` | **1100** | |
| `6` | Sniper | **5** | LMB: **1** | `onEmpty` | **3500** | RMB Zoom: kein Munitionsverbrauch |
| `7` | Gatling | **30** | LMB/RMB: **1** | `onEmpty` | **5000** | |
| `8` | Pulse Lance | **10** | LMB: **1**; RMB Beam-Overheat | `onEmpty` / Beam **2000** | Strahl max. **3000** ms |
| `9` | Bio Lobber | **10** | LMB/RMB: **1** (RMB skaliert mit Charge) | `onEmpty` | **2000** | |

Details pro Waffe: frühere Einzelabschnitte unverändert gültig — Pistol Burst, Shock perShot, Rocket `reserved`, Ripper ×2, Flak perShot, Pulse Beam-Pool, Bio Charge-Vorschau (Implementierung in `ammo-controller.ts` + `weapon-arsenal.ts`).

---

## 6. Schadenswerte pro Projektil / Treffer

Einheit für `applyImpact`. Zielwerte für Balance; Code in `FireProfile.damage` / `ImpactProfile.directDamage`.

| Slot | Waffe | Modus | Schaden | Bemerkung |
|------|--------|-------|---------|-----------|
| `1` | Pistol | LMB / RMB | **22** / **18**×3 | |
| `2` | Shock | LMB / RMB | **48** / **52** | Combo **96** |
| `3` | Rocket | LMB/RMB | **84** | Splash |
| `4` | Ripper | LMB / RMB | **38** / **44** | |
| `5` | Flak | LMB / RMB | **14**×9 / **42**+Splitter | |
| `6` | Sniper | LMB | **110** | |
| `7` | Gatling | LMB/RMB | **11** | |
| `8` | Pulse | LMB / RMB | **24** / **9**/Tick | |
| `9` | Bio | LMB / RMB | **26** / **9–88** | Charge |
| `0` | Redeemer | LMB/RMB | **135** | 14 s Reload |

---

## 7. Geplant — Revive/Hire-Channel-Panel ⬜

Siehe **`docs/revive-hire.md` §5**:

- Eigenes Panel während **`R`-Hold** in Nähe eines Toten.
- Label **Reanimieren** (1 s) vs **Anheuern** (2 s).
- Fortschrittsbalken **0 % → 100 %** (linear); Abbruch → Balken reset.
- Sichtbar für Channelnden und Toten.

Stilistisch an Reload-Balken (§4) anlehnen — kompakt, `pointer-events: none`.

---

## 8. Implementierungsphasen (Ammo — historisch)

| Phase | Inhalt | Status |
|-------|--------|--------|
| **A — Spec** | Dieses Dokument | ✅ |
| **B — Daten** | `AmmoProfile` in `WEAPON_DEFINITIONS` | ✅ |
| **C — Runtime** | `ammo-controller.ts` | ✅ |
| **D — Integration** | `weapon-arsenal.ts`, Rocket/Ripper/Flak | ✅ |
| **E — UI** | `ammo-hud.ts`, DOM, CSS | ✅ |
| **F — Polish** | FP: Ammo aus; Sound-Hook | teilweise ✅ |

**Team-Member-Count:** Phase eigenständig ✅ (§1).

---

## 9. Redeemer (`0`)

**1** □, `perShot` Reload **14 s** nach LMB/RMB. Schaden **135**.

---

## 10. ASCII — Ammo-Zustandsfluss

```
[Feuer erlaubt?] ──no──► (Reload läuft?) ──ja──► unterer Balken 0→100%
      │                           │
     yes                          no
      ▼                           ▼
 consume ammo              block fire
      │
 ammoCurrent > 0 ? ──no──► startReload(reloadMs) ──► on complete: ammoCurrent = ammoMax
      │
     yes
      ▼
  (Sniper: betweenShotReload nach Schuss)
```

---

## 11. Death / Auto-Respawn-Overlay ✅

Vollbild über der Shell während der lokale Spieler tot ist (`death-respawn-hud.ts`). Stil angelehnt an Match-Countdown (`match-flow-screen.ts`), Copy für Tod.

| Element | CSS | Inhalt |
|---------|-----|--------|
| Titel | `.funnel-death-overlay__title` | **WASTED** (rot, groß) |
| Label | `.funnel-death-overlay__kicker` | **Respawn in** |
| Countdown | `.funnel-death-overlay__value` | **5 → 4 → 3 → 2 → 1** (tabular-nums) |

- Sichtbar ab Tod bis Auto-Respawn (`PLAYER_AUTO_RESPAWN_SECONDS` = 5).
- Timer-Quelle: `player.deathSnapshot.diedAtMs` + `player-auto-respawn.ts`.
- Bei **0** → `PlayerController.respawnAtFaction()` — Overlay aus, Spieler lebt am Team-Spawn.
- Revive/Hire-Channel-UI kommt später (§5 in `revive-hire.md`); **`R`** ist dafür reserviert, kein Sofort-Respawn mehr.

---

## 12. Offene Feinentscheidungen

1. **Pulse RMB:** 1 □ beim Beam-Start — Ist: Verbrauch nach Strahldauer.
2. **Waffenwechsel:** volles Magazin — ✅.
3. **Shock:** **15 □** — ✅.
4. **Sniper Magazin-Reload:** 3,5 s — Playtest.

---

*Stand: 2026-05-24 — Death-Overlay WASTED + 5-s-Countdown ✅; Revive/Hire-UI in `revive-hire.md`.*
