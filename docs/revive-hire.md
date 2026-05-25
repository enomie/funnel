# Revive & Hire — Tod, Auto-Respawn, Reanimation, Anheuerung

Design-Spec für Spieler-Tod im Match.

**Verwandt:** `docs/team-design.md` (Viewer-Farben, Fraktion), `docs/introduction.md` §8, Team-HUD (`team-hud.ts`), Death-Overlay (`docs/interface-ui.md`).

---

## Implementierungsstand

| Bereich | Status |
|---------|--------|
| Team-HUD — Mitgliederzahl (§7) | ✅ |
| Auto-Respawn **5 s** + WASTED-Overlay (§2) | ✅ |
| Revive — Teammate, 1 s, `R`, **1,5 m** (§3, §11) | ✅ |
| Hire — Gegner, 2 s, Teamwechsel, **1,5 m** (§4, §11) | ✅ |
| Channel-Panel 0→100 % (§5, §11.6) | ✅ |
| Timer-Pause bei Channel (§6, §11.2) | ✅ |
| Hot-Path — 6 Säulen (§11) | ✅ |
| Team-HUD nach Hire (`onHired`, 16/14) (§7) | ✅ |
| Schießen während Channel blockiert (§10.11) | ✅ |
| Bot-Downed **5 s** + Pause (`bot-respawn.ts`) | ✅ |

**MVP (2026-05-25):** Revive/Hire funktioniert für **lokalen Spieler** als Channelnder (Player + Bot-Leichen). Dev-Tod **`K`** (`player-controller.ts`). **Offen:** Bot-KI-Channel (Phase K); Stand-up-Clip `animation-standing-up.dae` (aktuell `reviveLocomotion()`).

---

## 1. Ablauf beim Tod

1. Actor stirbt → Death-Animation (`walking-to-dying`), Physik/Kapsel wie heute (`actor-death.ts`).
2. **Sofort:** Vollbild-Overlay **WASTED** + **Respawn in** + Countdown **5 → 4 → 3 → 2 → 1** (`death-respawn-hud.ts`).
3. **Auto-Respawn-Timer: 5 Sekunden** ab Tod (`player-auto-respawn.ts`).
4. Während dieser 5 s kann der Tote **reanimiert** (Verbündeter) oder **angeheuert** (Gegner) werden — siehe §3 und §4.
5. Läuft der Timer ohne Revive/Hire aus → **Auto-Respawn** im **Spawn-Pocket** — letzte **15 m** am Bulkhead (`z ±135…±150`), Fraktion unverändert (`player-spawn.ts`). **Nicht** der Match-Start-Intro-Drop (`z ±105…±120`).

Spieler sieht die Leiche in der Welt (Kamera bleibt aktiv); Overlay liegt über dem Match-HUD.

---

## 2. Auto-Respawn-Timer (5 s) ✅

| Eigenschaft | Wert |
|-------------|------|
| Dauer | **5 s** ab Tod (`PLAYER_AUTO_RESPAWN_SECONDS`) |
| Overlay während Tod | **WASTED** · **Respawn in** · große Zahl **5…1** |
| Standard-Ende | Respawn im **Spawn-Pocket** — **0…15 m** vom Bulkhead (`z ±135…±150`) |
| Fraktion nach Auto-Respawn | **Unverändert** (kein Teamwechsel) |
| Sofort-Respawn **`R`** | **Entfernt** — `R` = Revive/Hire-Channel halten (§3 / §4) |

Der Timer ist die **Fallback-Lösung**, wenn niemand reanimiert oder anheuert.

### Ist-Implementierung

| Teil | Modul |
|------|--------|
| Timer + Countdown | `src/player/player-auto-respawn.ts` |
| Spawn-Position | `src/player/player-spawn.ts` — `playerFactionSpawnPosition(faction)` |
| Respawn-Reset | `PlayerController.respawnAtFaction()` — Health, Physik, Locomotion |
| Overlay | `src/ui/death-respawn-hud.ts` + `.funnel-death-overlay*` in `style.css` |
| Loop | `src/app/funnel-app.ts` — nach `finishFrame`, wenn `isDead` |

---

## 3. Reanimation (Revive) — Verbündete ✅

| Eigenschaft | Wert |
|-------------|------|
| Wer | Nur **Teammates** (gleiche Fraktion wie der Tote) |
| Distanz | **≤ 1,5 m** zum Toten (`REVIVE_HIRE_PROXIMITY_M`) — siehe §10.2 |
| Input | **`R` halten** — Channel **1 s** |
| Ergebnis | Toter lebt **an Ort und Stelle** wieder auf, **gleiche Fraktion**, gleiche Viewer-Farbe (Ally = Blau) |
| Timer | Während des Revive-Channels wird der **5-s-Auto-Respawn-Timer pausiert** |
| UI | Channel-Panel mit Fortschrittsbalken — siehe §5 |

**Abbruch:** `R` loslassen, Nähe verlassen (> 1,5 m XZ), Channelnder stirbt, Match-Ende, oder Ziel respawned → Channel bricht ab, **Timer läuft weiter** ab dem pausierten Stand. **Treffer ohne Tod** brechen den Channel **nicht** ab.

---

## 4. Anheuerung (Hire) — Gegner ✅

| Eigenschaft | Wert |
|-------------|------|
| Wer | Nur **Gegner** (andere Fraktion als der Tote) |
| Distanz | Wie Revive — **≤ 1,5 m** zum Toten |
| Input | **`R` halten** — Channel **2 s** |
| Ergebnis | **Teamwechsel:** Fraktion → die des Anheuernden; **Farbwechsel / Seitenwechsel** — der Wiederbelebte kämpft ab sofort für das Team des Anheuernden (viewer-relatives Ally/Enemy gemäß `docs/team-design.md`) |
| Timer | Während des Hire-Channels wird der **5-s-Auto-Respawn-Timer pausiert** |
| UI | Channel-Panel mit Fortschrittsbalken — siehe §5 |

**Abbruch:** Wie Revive (§3) — vor Ablauf der 2 s abbrechen → **Timer läuft weiter**.

Hire ist kein „Respawn an fremder Base“, sondern **Reanimation + Fraktionsflip** am Leichenort.

---

## 5. Channel-Panel — Revive / Hire (Fortschrittsbalken) ✅

Während **`R` gehalten** wird und der Actor in Nähe eines Toten channelt, erscheint ein **eigenes HUD-Panel** — für den **Channelnden** (Spieler der `R` hält) und für den **Toten** (Spectator auf dem Leichnam), damit beide den Vorgang sehen.

| Element | Verhalten |
|---------|-----------|
| **Panel** | Sichtbar nur während aktivem Channel (Revive oder Hire); **Mitte Bildschirm** (`top: 54%`, `z-index: 31`, über WASTED) |
| **Label** | **`REVIVE`** vs **`HIRE`** (Englisch, wie restliches Match-HUD) |
| **Fortschrittsbalken** | **Aufsteigend** von **0 % → 100 %** + Prozent-Ziffer darunter |
| **Revive** | Balken füllt sich linear über **1 s** (Ally-Farben) |
| **Hire** | Balken füllt sich linear über **2 s** (Orange-Akzent) |
| **Abbruch** | `R` loslassen, Nähe verlassen, Channelnder stirbt, Match-Ende → Panel aus, Balken **zurück auf 0 %** |
| **Erfolg** | Bei 100 % → Panel schließt, Revive/Hire-Effekt (§3 / §4) |

Der Balken spiegelt **nur den Channel-Fortschritt** (1 s / 2 s), nicht den 5-s-Auto-Respawn-Timer.

### Ist-Implementierung

| Teil | Modul |
|------|--------|
| HUD | `src/ui/revive-hire-hud.ts` — `ReviveHireHud.update(visible, mode, progress01)` |
| Mount | `funnel-app.ts` — Panel an `dom.shell` (nicht `.funnel-hud`) |
| Styles | `src/style.css` — `.funnel-revive-hire-panel*` |
| Wiring | `revive-hire-channel.ts` → `readSpectatorReviveHireHud()` für toten Spectator |

---

## 6. Timer-Pause — Regeln

| Situation | Auto-Respawn-Timer |
|-----------|-------------------|
| Revive-Channel aktiv (1 s) | **Pausiert** |
| Hire-Channel aktiv (2 s) | **Pausiert** |
| Channel erfolgreich abgeschlossen | Timer **entfällt** (Actor lebt, kein Auto-Respawn) |
| Channel abgebrochen | **Weiter** ab pausiertem Rest |
| Kein Revive/Hire | Läuft bis 5 s → Auto-Respawn |

Nur **ein** Channel gleichzeitig pro totem Actor (wer zuerst channelt — Detail bei Implementierung).

---

## 7. Team-HUD — Mitgliederzahl ✅

In den **beiden Team-Panels** oben (Own / Enemy) ist sichtbar, **wie viele Mitglieder jedes Team aktuell hat**.

### Regeln

- Zählt **lebende** Spieler + Bots pro Fraktion (`alpha` / `beta`).
- **Tote** Actors (`health.isDead`) zählen **nicht**.
- **Own-Badge** = Fraktion des lokalen Viewers; **Enemy-Badge** = `oppositeFaction`.
- Nach **Tod:** `onDeath` — Ziel-Team **−1** (z. B. 15/14).
- Nach **Revive:** `onRevive` — gleiche Fraktion **+1** (z. B. zurück 15/14).
- Nach **Hire:** `onHired` — Gegner **−1** (falls noch gezählt) + eigenes Team **+1** via `onFactionChange` oder `onRevive` (z. B. 16/14 bei 15v15-Start).

### Ist-Implementierung

| Teil | Modul |
|------|--------|
| Zählung (inkrementell) | `src/combat/team-roster-count.ts` — `TeamRosterCounter` (`onDeath` / `onRevive` / `onHired` / `onFactionChange`) |
| Initial-Rebuild | `funnel-app.ts` — nach Registrierung des lokalen Spielers + aller Bots |
| HUD | `src/ui/team-hud.ts` — `TeamHud.update(…, roster)` |
| DOM | `src/app/dom.ts` — `.funnel-team-badge__members` („`N` members“) zwischen Label und Kill-Zahl |
| Events | `actor-died`, `actor-respawned`, `actor-revived`, `actor-hired` → Counter + `refreshTeamHud()` |

Kill-Zahl (große Zahl unter „members“) bleibt unverändert über `TeamKillScore`.

---

## 8. Kurzüberblick

```
Tod
 └─ WASTED-Overlay + 5-s-Countdown (5…1)
      ├─ Teammate: ≤1,5 m, R halten 1 s → Revive (gleiches Team, Timer pausiert)   ✅
      ├─ Gegner:   ≤1,5 m, R halten 2 s → Hire (Teamwechsel + Farbe, Timer pausiert) ✅
      └─ Abbruch Channel → Timer weiter → Auto-Respawn an Team-Spawn

Team-HUD (live): lebende Mitglieder pro Fraktion — Own / Enemy Badge
```

---

## 9. Nächste Schritte

| Priorität | Inhalt | Status |
|-----------|--------|--------|
| — | MVP Revive/Hire (§3–§6, §7) | ✅ |
| K | Bot-KI channelt Revive/Hire (`bot-brain.ts`) | ⬜ |
| — | Stand-up-Animation `animation-standing-up.dae` statt `reviveLocomotion()` | ⬜ |
| — | i18n (`src/texts/translations.json`) — Labels derzeit hardcoded EN | ⬜ |

Detail-Referenz: **§10** (Ist) · Architektur: **§11**.

---

## 10. Implementierung (Detail — Ist 2026-05-25)

Revive/Hire **nur innerhalb der 5-s-Downed-Phase**, **1,5 m** Interaktionsradius (XZ² + Y-Slop). **Strategischer Code-Fokus:** §11 (6 Säulen).

### 10.1 Konstanten

| Konstante | Wert | Modul |
|-----------|------|--------|
| `REVIVE_HIRE_PROXIMITY_M` | **1,5** | `src/combat/revive-hire-config.ts` |
| `REVIVE_HIRE_Y_SLOP_M` | **2,5** | wie oben |
| `REVIVE_CHANNEL_SECONDS` | **1** | wie §3 |
| `HIRE_CHANNEL_SECONDS` | **2** | wie §4 |
| `PLAYER_AUTO_RESPAWN_SECONDS` | **5** | `src/player/player-auto-respawn.ts` |

**Distanz-Metrik:** XZ **Distanz²** vs. `REVIVE_HIRE_PROXIMITY_M²`; separater Y-Slop (`Math.abs(dy) <= REVIVE_HIRE_Y_SLOP_M`). Kein `sqrt`, keine 3D-Kugel.

### 10.2 Proximity — wer, wann, wie nah

| Regel | Detail |
|-------|--------|
| Fenster | Nur solange Auto-Respawn-Countdown **> 0** (`playerAutoRespawnCountdownSeconds` / Bot-Äquivalent) |
| Channelnder | **Lebend**, `matchLive`, kein Redeemer-Guided; **Feuer blockiert** während Channel (`!reviveHireChannel.isChanneling` in Waffen-Tick) |
| Ziel | **Toter** Actor in Registry (`health.isDead`), Leiche noch in Welt (`deathSnapshot.applied`) |
| Radius | Channelnder-Kapselzentrum → Toter-Kapselzentrum, **≤ 1,5 m** (XZ) |
| Modus | Gleiche Fraktion → **Revive** (1 s); Gegner-Fraktion → **Hire** (2 s) |
| Auswahl | Bei mehreren Toten in Reichweite: **nächster** (kleinste Distanz²); ein aktiver Channel pro Channelnder |
| Exklusivität | Pro Leiche max. **ein** Channel gleichzeitig (Lock auf `targetActorId`) |

**Registry-Lücke heute:** `ActorRegistry.forEachActorNear` überspringt Tote. **Nicht** jeden Frame alle ~30 Actors scannen — siehe **§10.14** (Downed-Index, Early-Exit).

### 10.3 Input — `R` halten ✅

| Ist | Modul |
|-----|--------|
| `reviveChannelHeld: boolean` — solange `KeyR` in `#keys` | `input-state.ts` |
| Live-Abfrage im Loop | `input.reviveChannelHeldNow()` |
| Edge `respawnPressed` | **Entfernt** — kein Sofort-Respawn (§2) |

### 10.4 Timer-Pause (5-s-Fenster) ✅

Felder auf `ActorDeathSnapshot` (`actor-death.ts`): `respawnPauseAccumMs`, `respawnPauseStartedMs`, `channelerId`, `channelMode`, `channelProgress`. Helper `effectiveRespawnElapsedMs()`.

| Ereignis | Timer |
|----------|-------|
| Channel start (gültige Nähe + `R` held) | `respawnPauseStartedMs = now` |
| Channel Abbruch | `respawnPauseAccumMs += now - started`; `started = 0` |
| Channel Erfolg | Auto-Respawn entfällt — Snapshot wird via `resetActorDeathPhysics` geleert |
| Kein Channel | läuft normal bis 5 s |

**WASTED-Overlay:** Countdown nutzt dieselbe effektive Elapsed-Funktion → Zähler **friert** während Channel (§6).

**Bot-Timer:** `BOT_RESPAWN_DELAY_MS` = Spieler-5 s + Stagger (`bot-respawn.ts`); Auto-Respawn blockiert solange `deathSnapshot.channelerId !== null` (`bot-actor.ts` `#tryRespawn`).

### 10.5 Channel-State-Machine

Neues Modul **`src/combat/revive-hire-channel.ts`** — allocation-frei, module-scoped Temps, **Early-Exit** (§10.14):

```
Idle  ← 99 %+ Frames: 1 Guard, return (downedCount===0 oder !R&&!channeling)
  └─ R held + lebend + matchLive + downedCount>0
       └─ scan nur Downed-Index (typ. 0–3) in 1.5m → pick nearest
            ├─ same faction → mode=revive, duration=1s
            └─ else           → mode=hire,   duration=2s
                 └─ Channeling (lock targetActorId)
                      ├─ each frame: R held ∧ in range ∧ target still dead ∧ countdown>0
                      │     → progress += dt; pause timer on target
                      ├─ progress >= duration → Complete → revive/hire effect
                      └─ else → Abort → reset progress; resume timer
```

**Globale Locks:** Feld am Death-Snapshot `channelerId: string | null` — **kein** pro-Frame `Map`-Rebuild.

**Tick-Ort:** `funnel-app.ts` — Reihenfolge pro Frame:

1. `botRoster.update` (Tod-Sync)
2. `syncDownedActors` wenn `R` held oder Channel aktiv
3. `reviveHireChannel.tick` + HUD
4. `botRoster.tryAutoRespawn` (nach Channel-Tick)

### 10.6 Effekte bei Erfolg

#### Revive (gleiche Fraktion)

| Schritt | Player | Bot |
|---------|--------|-----|
| Health | `health.respawn()` | gleich |
| Physik | `resetActorDeathPhysics` — **Translation behalten** | gleich |
| Locomotion | `visual.reviveLocomotion()` | gleich |
| Teleport | **Nein** — Gegenteil von `respawnAtFaction()` | `BotController.respawnAt` **nicht** nutzen; neu: `reviveInPlace()` |
| Fraktion | unverändert | unverändert |
| Event | `actor-revived` | gleich |
| Roster | `teamRosterCounter.onRevive` via `actor-revived` | gleich |

Neue Methoden:

- `PlayerController.reviveInPlace()` — wie `respawnAtFaction`, aber **ohne** `spawnAtFaction()`
- `BotController.reviveInPlace()` — Reset Death + Brain optional `reset()` (TBD: Waffe behalten vs. Spawn-Roll)

#### Hire (Gegner-Fraktion)

Alles wie Revive, plus:

| Schritt | Detail |
|---------|--------|
| Fraktion | `combatActor.setFaction(channelerFaction)` |
| Lokaler Spieler **wird** angeheuert | `playerTeam.assign(hirerFaction, 'hire')` — **kein** Teleport (`onChange`-Guard: nur wenn `!isDead` → OK, Leiche bleibt) |
| Lokaler Spieler **heuert an** | Ziel-`setFaction`; Bot-Visual `applyViewerColors(playerTeam)` |
| Viewer-Farben | `BotVisual.setFaction()` + `applyViewerColors()` bei Hire |
| Event | `actor-hired` `{ actorId, previousFaction, newFaction, hirerId }` |
| Roster | `teamRosterCounter.onHired(id, previousFaction, newFaction)` — deckt Tod-decrement + Fraktionswechsel ab |

**Wichtig:** `PlayerTeam.onChange` teleportiert lebende Spieler bei `hire`/`dev` — nach `reviveInPlace()` ist der Actor **lebend an der Leiche**; kein Spawn-Pocket. Guard in `funnel-app.ts` (Zeile 367–369) bleibt korrekt.

### 10.7 UI — Channel-Panel ✅

Modul **`src/ui/revive-hire-hud.ts`** + CSS in `style.css`:

| Zustand | Anzeige |
|---------|---------|
| Channelnder (lebend) | Panel **Bildschirmmitte**: Label **`REVIVE`** / **`HIRE`**, Balken + **%** |
| Toter (lokal) | Gleiches Panel **zusätzlich** zum WASTED-Overlay via `readSpectatorReviveHireHud` |
| Abbruch | Panel aus, Balken 0 % |

Mount an `dom.shell` — `.funnel-revive-hire-panel*` (`z-index: 31` > WASTED `30`).

`DeathRespawnHud` unverändert für WASTED; Channel-HUD orthogonal.

### 10.8 Events & HUD-Refresh

Erweiterung `src/core/game-events.ts`:

```typescript
interface ActorRevivedEvent {
  readonly actorId: string;
  readonly faction: FactionTeam;
  readonly reviverId: string;
}

interface ActorHiredEvent {
  readonly actorId: string;
  readonly previousFaction: FactionTeam;
  readonly newFaction: FactionTeam;
  readonly hirerId: string;
}
```

`funnel-app.ts`:

- `actor-revived` → `teamRosterCounter.onRevive`
- `actor-hired` → `teamRosterCounter.onHired`
- `actor-respawned` → `onRevive` (Auto-Spawn am Pocket)
- `refreshTeamHud()` bei allen obigen + Kill

### 10.9 Bot-KI (später — nicht MVP)

`docs/introduction.md` §15 vs. 15: Bots sollen downed Actors finden und channeln. **Nicht** in erster Code-Phase:

- Perception: downed Snapshots in `bot-target-snapshots.ts` (`isDead: true` heute gefiltert)
- Brain-Objective: „revive ally“ / „hire enemy corpse“
- Nutzt dieselbe `revive-hire-channel.ts`-API mit `channelerId = botId`

MVP: **nur lokaler Spieler** als Channelnder.

### 10.10 Implementierungsphasen

| Phase | Inhalt | Status |
|-------|--------|--------|
| **A–J** | Konstanten → Bot-Downed 5 s + Pause | ✅ |
| **K** | Bot-KI Revive/Hire | ⬜ |

**Verify je Phase:** `npm run lint`, `npm run build`, Browser: Dev-`K` Tod → Mate `R` 1 s in 1,5 m; Gegner `R` 2 s; Timer-Pause sichtbar; Hire flippt Badge-Count.

### 10.11 Edge Cases

| Fall | Verhalten |
|------|-----------|
| Match-Ende (`endMatch`) | Channel sofort abbrechen |
| Auto-Respawn tick während Channel | Pause sollte verhindern — wenn Pause-Bug: harter Abbruch, Spawn-Pocket gewinnt |
| Toter rutscht (Physik frozen) | Leiche pinned (`pinBodyCapsuleToGround`) — Distanz stabil |
| Channelnder stirbt mid-Channel | Abbruch, Pause auf Ziel enden |
| Channelnder getroffen (noch lebend) | Channel **läuft weiter** — nur Tod bricht ab |
| Feuer während Channel | **Blockiert** — Waffen-Tick übersprungen wenn `isChanneling` |
| Selbst-Revive | Verboten (Channelnder muss leben, Ziel ≠ local wenn dead spectator — OK) |
| Teamkill-Leiche | Revive/Hire nach Fraktion **des Toten**, nicht des Killers |
| `movementLocked` (Intro-Drop) | Kein Channel bis Match live + unlocked |

### 10.12 Code-Inventar (Ist — Anknüpfpunkte)

| Bereich | Modul | Ist |
|---------|-------|-----|
| Tod-Snapshot + Pause | `actor-death.ts` | ✅ |
| Downed-Index | `downed-actor-index.ts` | ✅ |
| Channel FSM | `revive-hire-channel.ts` | ✅ |
| Loop | `funnel-app.ts` | ✅ |
| Revive/Hire Effekte | `player-controller.ts`, `bot-actor.ts`, `bot-controller.ts` | ✅ |
| Roster | `team-roster-count.ts` — `onHired` | ✅ |
| Channel-HUD | `revive-hire-hud.ts` | ✅ |
| Events | `game-events.ts` | ✅ |

### 10.13 Entscheidungen (Ist)

1. **Y-Achse:** XZ² + `Math.abs(dy) <= 2.5` (`REVIVE_HIRE_Y_SLOP_M`).
2. **Waffe nach Revive:** Magazin/Waffe **behalten**.
3. **Bot nach Revive/Hire:** `#brain.reset()` + `#targetFocus.reset()` — **ja**.
4. **Feuer während Channel:** **blockiert** (`isChanneling`-Guard in `funnel-app.ts`).
5. **Events:** **`actor-revived` + `actor-hired`** (getrennt).
6. **Schaden ohne Tod:** Channel **nicht** abbrechen (nur Tod des Channelnders).

### 10.14 Performance — Hot-Path-Regeln (Pflicht)

Ausführung zu **§11.1** / **§11.7**. Revive/Hire darf **keinen messbaren Frame-Time-Drift** im 15v15-Stress erzeugen.

#### Zero-Cost wenn inaktiv (Default)

`tickReviveHireChannel()` in `funnel-app.ts` — **eine** Funktion, Guard-Kette oben, sofort `return`:

| Guard | Grund |
|-------|--------|
| `!matchLive \|\| matchOver` | Kein Match |
| `#downedCount === 0` | Keine Leiche in der Welt — **kein Scan, kein HUD** |
| Spieler lebt **und** `!reviveChannelHeld` **und** `!localChannel.active` | Niemand drückt `R`, kein laufender Channel |

Typischer Kampf-Frame ohne Tod in der Nähe: **~3 Integer-Checks + 1 Branch** — vernachlässigbar.

Toter lokaler Spieler (Spectator): nur prüfen ob `deathSnapshot.channelerId !== null` → HUD-Progress (O(1)), **kein** Actor-Scan.

#### Downed-Index — nie Full-Registry-Scan

**Verboten im Animation-Loop:** `registry.forEachActor` / `.filter()` / `.map()` für Proximity.

**Stattdessen** event-maintained Liste (swap-pop, cap = Roster-Größe):

```typescript
// actor-registry.ts oder revive-hire-channel.ts — bei actor-died push, bei respawn/revive swap-pop
#downedActors: CombatActor[] = [];
#downedCount = 0;

onActorDowned(actor: CombatActor): void { /* push */ }
onActorUp(actor: CombatActor): void { /* swap-pop by id */ }
```

- Pflege nur bei `actor-died`, `actor-respawned`, `actor-revived`, `actor-hired` — **0 Kosten** in Frames ohne Tod-Event.
- Proximity-Scan nur über `#downedActors[0…count)` — in Stress typ. **0–3**, Worst-Case ~15 nach Cluster-Kills, **nicht** 30 lebende + tote Volliteration.
- **Kein** separates Spatial-Grid für Downed nötig (Radius 1,5 m, Liste klein). Grid lohnt erst bei Bot-KI-Phase K mit vielen gleichzeitigen Channel-Ziel-Suchen.

#### Wann Proximity wirklich läuft

| Situation | Arbeit pro Frame |
|-----------|------------------|
| Kein Downed | **0** (Guard) |
| Downed, Spieler lebt, `R` nicht gedrückt | **0** (Guard) |
| `R` held oder Channel aktiv | O(`downedCount`) Distanz² (XZ), file-scoped scratch |
| Channel aktiv, Ziel locked | **1** Distanzcheck zum locked Target — kein Re-Scan aller Downed |

Nach Target-Lock: nur noch `dist²(channeler, target) <= R²` — ein Hypot/Sub, kein Loop.

#### Zero-GC (Pflicht laut `funnel-performance`)

| ❌ Verboten | ✅ Erlaubt |
|------------|-----------|
| `new Vector3()` pro Frame | Module-scoped `_dx`, `_channelerPos` |
| `.filter()` / `.map()` / `[...]` | `for (i=0; i<downedCount; i++)` |
| `JSON` / String-Concat in Tick | Stable `actorId`-Vergleiche |
| Pro-Frame `Map`/`Set` anlegen | `channelerId`-Feld am Snapshot |
| DOM write jedes Frame | HUD wie `DeathRespawnHud`: nur bei sichtbarkeits-/prozent-**change** |

#### Rapier / Physik

- Distanz aus `body.translation()` nach `world.step` — **kein** Raycast, kein `intersectionsWithShape`, kein neuer Collider für „Revive-Zone“.
- Pause-Timer: reine Arithmetik auf `ActorDeathSnapshot` — O(1).

#### UI / HUD

- `ReviveHireHud.update(visible, mode, progress01)` — intern `#lastProgressPct` / `#lastVisible`; DOM nur bei Änderung (Reload-Balken-Muster aus `ammo-hud.ts`).
- WASTED-Countdown: weiter nur Sekunden-**wechsel** updaten, nicht jedes Frame.

#### Erfolgs-Moment (teuer erlaubt — 1× pro Revive/Hire)

Einmalig bei Complete (nicht hot path):

- `reviveInPlace()` / `setFaction` / `reviveLocomotion()`
- Hire: **ein** Bot `applyViewerColors` — kein Roster-Walk
- `gameEvents.emit` + `refreshTeamHud()` — wie Kill heute, **event-driven**, nicht pro Frame

**Verboten:** `refreshTeamHud()` oder `applyViewerColors` auf gesamtes Roster in der Channel-Tick-Schleife.

#### Bot `#tryRespawn` — nicht verdoppeln

Bots prüfen Tod bereits in `bot-actor.ts` `#tryRespawn` (pro toter Bot, O(1)). Revive/Hire:

- Pause-Felder **dieselben** `ActorDeathSnapshot`-Helper nutzen (`effectiveRespawnElapsedMs`).
- **Kein** zweiter Registry-Scan in Bot-Loop für MVP.
- Bot-KI Channel (Phase K): ruft dieselbe `tryStartChannel(actorId, …)` API — Downed-Index wiederverwenden, nicht eigene Suche pro Bot pro Frame (Budget / Stagger wie `bot-nav-ray-budget`).

#### funnel-app Einbindung — Reihenfolge

```typescript
// Nach Input, vor teurem Combat — aber hinter matchLive-Guard:
if (matchLive && reviveHireChannel.mayTick(downedCount, input, localChannel)) {
  reviveHireChannel.tick(/* … */); // bounded
}
// Auto-Respawn-Block unverändert danach
```

`mayTick()` kapselt alle Early-Exits — Loop-Body bleibt lesbar.

#### Abnahme (Performance)

- [ ] Performance-Panel: **kein GC-Sägezahn** beim Halten von `R` neben Leiche (30 s Hold-Test).
- [ ] Frame time mit **0 Downed** identisch zu Stand vor Feature (Guard-only Diff ≈ 0).
- [ ] 15v15 Pro, 5 Leichen gleichzeitig, `R`-Scan: kein Stutter vs. Baseline sustained fire.
- [ ] Kein `forEachActor` in `tickReviveHireChannel` (eslint/grep-Check vor Merge).

---

## 11. Strategische Säulen — Architektur-Vorgaben (Dev)

Konzeptionell, ohne Code. **Beim Implementieren nur diese sechs Säulen im Kopf behalten** — Modul-Mapping, Phasen und Edge Cases stehen in §10. **Pflicht vor Merge.**

### 11.1 Säule 1 — „Zero-Cost-wenn-inaktiv“ (Hot-Path-Schutz)

Das wichtigste Element im `funnel-app.ts`-Tick ist der **Early-Exit**. Solange niemand am Boden liegt und niemand channelt, darf das System **nichts** tun.

- **3-Integer-Guard-Kette:** `mayTick()` / oberster Branch — wenn `#downedCount === 0` **und** niemand `R` hält **und** kein lokaler Channel aktiv → **sofort return**. Ein Branch schützt die Frame-Time in 15v15-Schlachten (typ. ~3 Checks, sonst null Arbeit).
- **Kein Registry-Walk:** Unter keinen Umständen global über `ActorRegistry` scannen, um „Tote in der Nähe“ zu finden. Downed-Liste rein **ereignisgesteuert** (`onActorDowned` Push / `onActorUp` Swap-Pop) als kompaktes `CombatActor[]`. Regelfall **0–3** Einträge im Loop, nie ~30.
- **Allocation-free Proximity:** Kein `new Vector3()`, kein `Vector3.distance()`. Achsen-Subtraktion über **file-scoped** Scratch (`_dx`, `_dz`, `_dy`).
- **Nach Target-Lock:** Nur **ein** Distanzcheck zum gelockten Ziel — kein Re-Scan aller Downed. Detail: §10.14.

### 11.2 Säule 2 — „Eingefrorene Zeit“ (Zeit-Arithmetik)

**Arithmetik schlägt Timer** — keine dynamischen JS-Intervalle, keine Tick-Abzüge gegen einen laufenden Timeout.

- **Absolute Wahrheit:** `diedAtMs` bleibt fix im Death-Snapshot.
- **Akkumulierter Offset:** Channel-Start → `respawnPauseStartedMs = jetzt`. Abbruch → Differenz nach `respawnPauseAccumMs`, `started = 0`. Erfolg → Snapshot reset, Auto-Respawn entfällt.
- **Kernformel:** `VergangeneZeit = Jetzt − Todeszeitpunkt − Pausenzeit` (Helper `effectiveRespawnElapsedMs`). Auto-Respawn **und** WASTED-Overlay nutzen dieselbe Formel → Countdown friert **mathematisch exakt** während Channel.

### 11.3 Säule 3 — Lock-Exklusivität & Input-Level

- **Die Leiche besitzt den Lock:** `channelerId` als Feld am **Death-Snapshot des Opfers** — wer zuerst channelt, blockiert das Ziel. Kein `Map`-Rebuild pro Frame.
- **Abbruch:** `R` loslassen, Channelnder stirbt, Distanz verloren, Match-Ende (§11.4) → Lock frei, Pause verbuchen, Channel-UI **sofort 0 %**. Schaden ohne Tod bricht **nicht** ab.
- **Level-Trigger:** `KeyR` von Edge (`respawnPressed`, ein Frame) auf Level (`reviveChannelHeld`, wie Ducken / `crouchHeld`) umstellen.

### 11.4 Säule 4 — Räumliche Geometrie (XZ vs. Y)

Festgelegt — keine 3D-Kugel, kein `sqrt`.

- **XZ ohne Wurzel:** `dx * dx + dz * dz <= REVIVE_HIRE_PROXIMITY_M * REVIVE_HIRE_PROXIMITY_M` (1,5 m → 2,25 m²).
- **Höhen-Slop separat:** `Math.abs(dy) <= REVIVE_HIRE_Y_SLOP_M` (**2,5 m**) — Treppen, Hänge, Plattformen; Y fließt **nicht** in die Radius-Quadrat-Summe ein.

### 11.5 Säule 5 — Wiederbelebung (In-Place vs. Teleport)

- **Entkopplung vom Spawn-System:** Regulärer Pfad = Spawn-Pocket (`respawnAtFaction`). Revive/Hire = **`reviveInPlace()`** — Health/Physik reset, Kapsel an **aktueller** Leichen-Position, **keine** Translation.
- **Zustandserhaltung:** HP/Shield voll; **Waffe, Magazin, Reserve-Munition** wie unmittelbar vor dem Tod — Sterben ist kein Magazin-Refill-Exploit.
- **Fraktions-Flip (Hire):** `setFaction` / `playerTeam.assign(_, 'hire')`. Viewer-Colors am Mesh + Event **`actor-hired`** (bzw. **`actor-revived`**) **einmalig im Erfolgsmoment**. Team-HUD liest Roster **event-basiert** — kein Roster-Walk pro Frame.

### 11.6 Säule 6 — UI-Schonung

- **Orthogonal:** Fortschritts-Panel 0→100 % unabhängig vom WASTED-Overlay; sichtbar für Channelnden **und** toten Spectator (wenn `channelerId` gesetzt).
- **Sichtbarkeits- und Änderungs-Guards:** Kein blindes DOM-Schreiben pro Frame. Letzter Zustand merken (`#lastVisible`, `#lastProgressPct`) — Update nur bei Sichtbarkeitswechsel oder signifikantem Prozent-Schritt (Reload-Balken / `ammo-hud.ts`). WASTED-Ziffer nur beim **Sekundenwechsel** (`DeathRespawnHud`-Muster).

### 11.7 Abnahme (Pflicht)

- [ ] 0 Downed → kein messbarer Frame-Time-Unterschied vs. Baseline
- [ ] 30 s `R`-Hold neben Leiche → kein GC-Sägezahn (Performance-Panel)
- [ ] 15v15 + sustained fire + mehrere Leichen → kein Stutter
- [ ] Grep: kein `forEachActor` inside Channel-Tick

---

*Stand: 2026-05-25 — MVP Revive/Hire ✅ (lokaler Spieler); §10 Ist-Doku; Bot-KI Phase K offen.*
