## Game-Loop — Umsetzungsstand

Kurzüberblick zur Loop-Performance. **Autoritative Tick-Referenz:** [`docs/ticks.md`](ticks.md).

Der Loop in `funnel-app.ts` ist sauber als Orchestrator aufgebaut — Input → Physics-Substeps → Interpolation → Bot-Prepare → Humanoid-Render → Combat/VFX → Render. Der Engpass liegt nicht in der Struktur, sondern in der **Kosten-Skalierung** unter vollem Pro-Roster.

| Parameter | Ist-Stand (Runtime-Profil) |
|-----------|----------------------------|
| Dev-Roster | **14 + 15 = 29 Bots** (`playersPerTeam: 15`) |
| Abnahme-Bar | **15 Mitglieder pro Teamseite** |
| Physics | `fixedStep` 10 ms, **max 3 Substeps** (= 30 ms Physics/Frame) |
| Delta-Clamp | 50 ms |
| Bot-Brain | **2 Hz** |
| Nav-Ray-Budget | **3 Refreshes/Frame** (global) |
| Render-Interpolation | ** aktiv** (Player, Bots, Dynamic Instances) |
| Load-Shedding | bei Physics-Backlog / engem Frame-Budget |
| Shadows (Runtime) | **aus** (`shadowsEnabled: false`) |
| Rain | Stückzahl ×0.35, Intervall ×2 |
| WorldEffects-Sources | **31** (1 `WorldProjectileSim` + 30 `WeaponArsenal`) |

---

### Loop-Ablauf (pro Frame)

Siehe Mermaid-Diagramm in [`docs/ticks.md`](ticks.md). Kurz: `GameFrameClock` → bis 3× `(player.fixedUpdate + botRoster.fixedUpdate + world.step + captureInterpolation)` → `preparePhysicsFrame` → `finishFrame` / `botRoster.update` → `tickFrameHousekeeping` → `render`.

---

## Erledigt (ehemals kritisch)

| Thema | Status |
|-------|--------|
| Nav-Ray Thundering-Herd | Phase-Offset + **3/Frame-Budget** |
| Brain @ 12 Hz | **2 Hz** (`botBrainTickHz`) |
| LoS pro Physics-Substep | nur noch @ Brain-Step |
| 6 Physics-Substeps | Runtime **3**, adaptiv reduzierbar |
| Kein Render-Interpolation | **implementiert** |
| Target-Snapshot-Allokation | `BotTargetSnapshotCache` in-place patch |
| `new RAPIER.Ray` pro Nav-Probe | Modul-Scratch |
| Rain ungedrosselt | Runtime-Skalierung |
| Team-HUD jedes Frame neu zählen | Dirty-Key in `match-live-ui-tick.ts` |
| Muzzle `new Vector3()` / Frame-Spread in Humanoid-Tick | Scratch + schlankes `tickHumanoidRenderFrame` |

Unter Chrome/M1 @ max refresh läuft der Loop heute **smooth** mit vollem Pro-Roster — die frühere Freeze-Analyse in dieser Datei beschreibt den **alten** Stand.

---

## Offene Hebel (priorisiert)

Details in [`docs/ticks.md`](ticks.md#bekannte-verbleibende-hebel-priorisiert).

1. **Anim-Mixer-LOD für entfernte Bots** — `#visualReducedLod` reduziert Mesh/Eyes, nicht den Mixer
2. Footstep-Tick an Distanz-LOD koppeln
3. Optional: World-Effects aus Registry in einen Roster-Pass konsolidieren (DRY, marginal FPS)
4. Dev-Profiler-Overlay (Substeps, Nav-Refreshes, Frame-p99) — noch nicht im Repo

---

## Baseline-Messung (Abnahme)

Im Browser (Performance Panel), Szenarien:

1. Idle — Countdown, keine Bewegung
2. Rain-Phase — erste Sekunden nach Reveal
3. Match live, stehend — HUD/Scoring only
4. Sprint + Feuer — Player solo
5. **Volles Pro-Roster (15v15) + Feuergefecht** — Worst Case

Pro Szenario: avg Frame Time, p99, GC-Spikes, `subSteps`-Max.

```bash
npm run lint && npm run build
```
