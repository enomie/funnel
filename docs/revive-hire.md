# Revive & Hire — Tod, Auto-Respawn, Reanimation, Anheuerung

Design-Spec für Spieler-Tod im Match.

**Verwandt:** `docs/team-design.md` (Viewer-Farben, Fraktion), `docs/introduction.md` §8, Team-HUD (`team-hud.ts`), Death-Overlay (`docs/interface-ui.md`).

---

## Implementierungsstand

| Bereich | Status |
|---------|--------|
| Team-HUD — Mitgliederzahl (§7) | ✅ |
| Auto-Respawn **5 s** + WASTED-Overlay (§2) | ✅ |
| Revive — Teammate, 1 s, `R` (§3) | ⬜ geplant |
| Hire — Gegner, 2 s, Teamwechsel (§4) | ⬜ geplant |
| Channel-Panel 0→100 % (§5) | ⬜ geplant |
| Timer-Pause bei Channel (§6) | ⬜ geplant |

**Interim:** Dev-Tod **`K`** (`player-controller.ts`); Bot-Auto-Respawn **4 s** (`bot-respawn.ts`) — unverändert, noch nicht an Spieler-Timer gekoppelt.

---

## 1. Ablauf beim Tod

1. Actor stirbt → Death-Animation (`walking-to-dying`), Physik/Kapsel wie heute (`actor-death.ts`).
2. **Sofort:** Vollbild-Overlay **WASTED** + **Respawn in** + Countdown **5 → 4 → 3 → 2 → 1** (`death-respawn-hud.ts`).
3. **Auto-Respawn-Timer: 5 Sekunden** ab Tod (`player-auto-respawn.ts`).
4. Während dieser 5 s kann der Tote später **reanimiert** (Verbündeter) oder **angeheuert** (Gegner) werden — siehe §3 und §4 (**noch nicht implementiert**).
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
| Sofort-Respawn **`R`** | **Entfernt** — `R` bleibt für geplanten Revive/Hire-Channel reserviert |

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

## 3. Reanimation (Revive) — Verbündete

| Eigenschaft | Wert |
|-------------|------|
| Wer | Nur **Teammates** (gleiche Fraktion wie der Tote) |
| Distanz | In **Nähe** des toten Actors (konkreter Radius bei Implementierung) |
| Input | **`R` halten** — Channel **1 s** |
| Ergebnis | Toter lebt **an Ort und Stelle** wieder auf, **gleiche Fraktion**, gleiche Viewer-Farbe (Ally = Blau) |
| Timer | Während des Revive-Channels wird der **5-s-Auto-Respawn-Timer pausiert** |
| UI | Channel-Panel mit Fortschrittsbalken — siehe §5 |

**Abbruch:** Loslassen oder Verlassen der Nähe **vor** Ablauf der 1 s → Channel bricht ab, **Timer läuft weiter** ab dem pausierten Stand.

---

## 4. Anheuerung (Hire) — Gegner

| Eigenschaft | Wert |
|-------------|------|
| Wer | Nur **Gegner** (andere Fraktion als der Tote) |
| Distanz | Wie Revive — in Nähe des toten Actors |
| Input | **`R` halten** — Channel **2 s** |
| Ergebnis | **Teamwechsel:** Fraktion → die des Anheuernden; **Farbwechsel / Seitenwechsel** — der Wiederbelebte kämpft ab sofort für das Team des Anheuernden (viewer-relatives Ally/Enemy gemäß `docs/team-design.md`) |
| Timer | Während des Hire-Channels wird der **5-s-Auto-Respawn-Timer pausiert** |
| UI | Channel-Panel mit Fortschrittsbalken — siehe §5 |

**Abbruch:** Wie Revive — vor Ablauf der 2 s abbrechen → **Timer läuft weiter**.

Hire ist kein „Respawn an fremder Base“, sondern **Reanimation + Fraktionsflip** am Leichenort.

---

## 5. Channel-Panel — Revive / Hire (Fortschrittsbalken)

Während **`R` gehalten** wird und der Actor in Nähe eines Toten channelt, erscheint ein **eigenes HUD-Panel** — für den **Channelnden** (Spieler der `R` hält) und für den **Toten** (Spectator auf dem Leichnam), damit beide den Vorgang sehen.

| Element | Verhalten |
|---------|-----------|
| **Panel** | Sichtbar nur während aktivem Channel (Revive oder Hire) |
| **Label** | Unterscheidet klar **„Reanimieren“** vs **„Anheuern“** |
| **Fortschrittsbalken** | **Aufsteigend** von **0 % → 100 %** |
| **Revive** | Balken füllt sich linear über **1 s** |
| **Hire** | Balken füllt sich linear über **2 s** |
| **Abbruch** | `R` loslassen, Nähe verlassen oder Channel unterbrochen → Panel aus, Balken **zurück auf 0 %** (nicht einfrieren) |
| **Erfolg** | Bei 100 % → Panel schließt, Revive/Hire-Effekt (§3 / §4) |

Der Balken spiegelt **nur den Channel-Fortschritt** (1 s / 2 s), nicht den 5-s-Auto-Respawn-Timer. Stil an bestehendes HUD anlehnen (z. B. Reload-Balken in `docs/interface-ui.md` — kompakt, gut lesbar im Match).

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
- **Tote** Actors (`health.isDead`) zählen **nicht** — Vorbereitung für Revive/Hire (§3 / §4).
- **Own-Badge** = Fraktion des lokalen Viewers; **Enemy-Badge** = `oppositeFaction`.
- Nach **Hire** (geplant): Zählung wechselt sofort — Actor wechselt Fraktion via `CombatActor.setFaction`.
- Nach **Revive** (geplant): Fraktion gleich — Toter zählt wieder in derselben Team-Zahl.

### Ist-Implementierung

| Teil | Modul |
|------|--------|
| Zählung | `src/combat/team-roster-count.ts` — `countTeamRosterMembers(registry)` über `ActorRegistry.forEachActor` |
| HUD | `src/ui/team-hud.ts` — `TeamHud.update(…, roster)` |
| DOM | `src/app/dom.ts` — `.funnel-team-badge__members` („`N` members“) zwischen Label und Kill-Zahl |
| Styles | `src/style.css` — `.funnel-team-badge__members` |
| Refresh | `src/app/funnel-app.ts` — `refreshTeamHud()` pro Match-Frame (`matchLive`) + bei Kill-Event und Dev-`T`-Flip |

Kill-Zahl (große Zahl unter „members“) bleibt unverändert über `TeamKillScore`.

---

## 8. Kurzüberblick

```
Tod
 └─ WASTED-Overlay + 5-s-Countdown (5…1)
      ├─ Teammate: R halten 1 s → Revive (gleiches Team, Timer pausiert)   [geplant]
      ├─ Gegner:   R halten 2 s → Hire (Teamwechsel + Farbe, Timer pausiert) [geplant]
      └─ Abbruch Channel → Timer weiter → Auto-Respawn an Team-Spawn

Team-HUD (live): lebende Mitglieder pro Fraktion — Own / Enemy Badge
```

---

## 9. Nächste Schritte (Implementierung)

1. ~~**Downed-State** — 5-s-Timer + WASTED-Overlay~~ ✅
2. **Channel-System** — Proximity, `R`-Hold, Pause/Resume Timer; `revive-hire-hud.ts` + Balken 0→100 % (§5).
3. **Revive / Hire** — Fraktionsregeln, `setFaction` + Viewer-Re-Tint bei Hire.
4. **Events** — optional `actor-revived` / `actor-hired` statt rein frame-basiertem HUD-Refresh (Member-Count funktioniert bereits über Registry).
