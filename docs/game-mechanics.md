# FUNNEL — Spielmechanik (Match-Punkte)

Spec für **Match-Ziel** und **Team-Punkte**. UI: `docs/interface-ui.md` §1.4 · Code: `team-match-points.ts`, `team-presence-scoring.ts`, `funnel-zones.ts`, `team-hud.ts`.

**Arena-Zonen:** `alpha` | `neutral` | `beta` — `src/arena/funnel-zones.ts`, `docs/environment.md`.

---

## Match-Ziel

- Ein Team gewinnt, wenn es **1000 Punkte** erreicht.
- Anzeige im Team-Badge: **`000 Points`** … **`999 Points`** (geclamped); ab 1000 → Match-Ende, Sieger-Badge leuchtet auf.

---

## Punktequellen

### 1. Kills ✅

- Jeder **Cross-Fraktion-Kill** (Gegner töten, nicht Teamkill) gibt der **Fraktion des Killers** **+1 Point**.
- Läuft über `actor-died` → `TeamMatchPoints.recordCrossFactionKill()`.

### 2. Präsenz in Feindgebiet ✅

- **Feindgebiet** = die **Spawn-/Heimatzone der gegnerischen Fraktion** (für Team Alpha: Zone `beta`; für Team Beta: Zone `alpha`). Neutral zählt nicht.
- Für **jede volle Sekunde**, in der ein **Spieler oder Bot** (lebend) in Feindgebiet steht, erhält **seine Fraktion +1 Point**.
- **Pro Actor pro Sekunde:** 3 Bots + 1 Spieler in feindlichem Gebiet = **+4 Points/Sekunde** für dieses Team (nicht +1 pauschal fürs Team).
- Nur **eigene** Fraktion bekommt die Punkte (Intrusion-Belohnung — du drückst in ihr Gebiet).

**Beispiel:** Zwei Alliierte in der gegnerischen Basis → **+2 Points/Sekunde** für das eigene Team, zusätzlich zu Kill-Punkten.

**Code:** `tickTeamPresenceScoring()` (1 Hz) in `team-presence-scoring.ts` — iteriert `ActorRegistry`, Zone-Test via `isInEnemyTerritory(faction, body.translation().z)` (`funnel-zones.ts`, nur **Z**, volle Tunnelbreite). Keine Punkte bei `isMatchOver`.

### Fight-Focus-Licht (Arena-Mitte oben) ✅

Die **Lichtkugel** in der Tunnelmitte (`create-scene.ts`, `PointLight` + emissive Orb) zeigt, **wo der Druck gerade höher ist**:

- Pro Heimatzone zählen lebende **Eindringlinge** (`intrusion-pressure.ts`).
- Leuchtet in **Fraktionsfarbe** des Teams, dessen Heimat **mehr** Eindringlinge hat (Alpha = rot, Beta = blau).
- Gleichstand oder niemand in Feindgebiet → **weiß** (Kugel + PointLight `0xffffff`).
- Besetzt → **knallrot** (Alpha) oder **knallblau** (Beta) aus `TEAM_BASE_HEX`.

**Beispiele:** Nur Beta in Alpha-Zone → **rot**. 2 Beta in Alpha, 3 Alpha in Beta → **blau** (Beta-Heimat unter schwererem Druck).

---

## Implementierungsstand

| Mechanik | Status |
|----------|--------|
| 1000 Points = Sieg, HUD, Glow | ✅ |
| Points durch Kills | ✅ |
| Points durch Feindgebiet-Präsenz (1/s/Actor) | ✅ |

**Gleichstand bei 1000:** unwahrscheinlich (Integer-Ticks); erster auslösender Kill oder Präsenz-Tick gewinnt.

---

## Verwandt

- Revive/Hire, Tod-Timer: `docs/revive-hire.md`
- Team-HUD: `docs/interface-ui.md`
- Fraktionen & Zonen: `docs/team-design.md`, `docs/environment.md`
