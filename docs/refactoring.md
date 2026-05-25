# Refactoring — Timing, Audio, Loop-Last

**Stand:** 2026-05-25 · `npm run lint` + `npm run build` grün.

---

## Kernproblem (live, ungelöst)

Unter Dauerlast (15v15, sustained fire, Bewegung) **degradiert die Session zeitlich** — nicht sofort, sondern nach einiger Spielzeit. Die Symptome kommen **in fester Reihenfolge**:

1. **Audio stottert** — Matsch, Aussetzer, Flyby/One-Shots hängen hinterher  
2. **FPS bricht ein** — Frame-Wall steigt, sichtbares Ruckeln  
3. **Alles wird langsam** — Input, Physik-Gefühl, Audio und Render wirken gemeinsam träge  

Das ist **kein einzelner Bug**, sondern eine **kaskadierende Überlastung**: Audio reagiert oft zuerst (eigener Thread + wachsender Graph), danach kippt der Main-Thread (Loop-Wall), zuletzt fühlt sich das gesamte Spiel „eingebremst“ an. Clock-Vereinheitlichung, Audio-Sweep und Bot-Load-Shedding haben die Architektur verbessert, **beheben dieses Degradationsmuster aber nicht**.

**Arbeitshypothese:** Langsame Akkumulation (Leases, Flyby-Sync pro Projektil, ungebremste VFX trotz Physik-Backlog) → Audio-CPU/Main-Thread-Rückkopplung → Death-Spiral.

**Erfolgskriterium:** 10+ Min 15v15 @ Max-Refresh ohne Phase 1–3.

---

**Kurzfassung:** Zweiter Fix-Pass (2026-05-25): Clock gehärtet, Audio-Guard + User-Gesture-Resume, Combat-Load-Shedding bei `physicsBacklogged`, Flyby-Sync gedrosselt, Visibility-Reset für Bots. **Im Browser verifizieren**, ob Phase 1–3 weg ist.

---

## Ursprüngliche Diagnose (Baseline)

Mehrere parallele Uhren plus fehlende Frame-Housekeeping-Pfade — kein Stack-Overflow-Risiko, eher Main-Thread-Dauer und Web-Audio-Last.

### Zeitquellen (Karte)

| Uhr | Wo | Wofür |
|-----|-----|--------|
| **rAF `now`** | `setAnimationLoop` → `GameFrameClock.beginRenderFrame(now)` | `deltaSeconds`, `frameNowMs`, Gameplay |
| **`performance.now()`** | `funnel-app.ts` **einmal/Frame** (FPS-Wall = `performance.now() - rAF now`), `game-frame-clock.ts` (Init/Visibility), UI, `audio-debug` | Wall-Time, nie Gameplay |
| **`AudioContext.currentTime`** | Fire/Impact/Foot, Reload, Lease-TTL | Web-Audio-Scheduling (absolut) |

**Design-Entscheidung (bleibt):** Gameplay nutzt `frameNowMs`; DSP-One-Shots bleiben an `currentTime` — das ist korrekt, solange Gameplay-Logik nicht `performance.now()` mischt.

### Risiko-Matrix (Baseline)

| Thema | Risiko vor Fix |
|-------|----------------|
| `performance.now()` in Combat/Spawn | Cooldown/TTL-Drift bei gedrosseltem rAF |
| Leere `tickGameAudio()` | Hängende Spatial-Leases, Flyby-Leichen |
| 24 Dauer-Oszillatoren in Flyby-Pool | Dauerhafte DSP-Last |
| `killAudio` bei `suspended` | Permanenter Audio-Ausfall nach Tab-Wechsel |
| Physik Substep-Cap, Rest ungebremst | Death-Spiral unter Dauerstress |
| Bot-Accumulatoren bei Tab-Hide | Kein Reset (nur Clock) |

---

## Umgesetzt ✓

### 1. Eine Spielzeit-Uhr (`frameNowMs`) — gehärtet

- **Loop:** rAF-`now` → `GameFrameClock` → `frameNowMs` für Gameplay; **eine** `performance.now()` pro Frame nur für FPS-Wall (`performance.now() - now`).
- **Kein Default-Fallback:** `spawnImpactBurst` / `spawnPuff` verlangen `spawnedAtMs` — kein verstecktes `performance.now()` in Render-Instancing.
- **Combat / Player / Bots:** kein `performance.now()` in `src/combat/`, `src/bots/`, `src/player/`.
- **Match-Ende / Revive:** `lastFrameNowMs` aus dem Loop, nicht Wall-Clock.

### 2. Audio-Housekeeping — gehärtet

```typescript
// src/core/frame-housekeeping.ts — zentral pro Frame (Lifecycle nie load-shedden)
tickFrameHousekeeping(frameNowMs, deltaSeconds, loadShedNonCritical, { segmentLineInstancing });
  ├─ tickGameAudio(frameNowMs)
  ├─ segmentLineInstancing.tick (TTL)
  └─ tickAllWorldEffects(..., loadShedNonCritical)

export function tickGameAudio(_frameNowMs: number): void {
  tickGameAudioGuard();
  sweepExpiredSpatialOneShots();  // inkl. redeemer-blast, mechanics-hold
  cleanupFlybyVoices();
  tickCombatWorldAudio();
}
```

- **Spatial-Lease-Regel:** Kein `createPanner()` + direkter `sfxInput`-Connect für Combat/Mechanics — nur `tryBeginSpatialOneShot` (Kurz) oder `tryBeginSustainedSpatialVoice` (Hold/Reload/Blast).
- **Redeemer-Blast:** `redeemer-blast`-Kind, gepoolter Lease, kein eigener 9-Node-Graph pro Detonation.
- **Mechanics-Hold:** Bio-RMB, Pulse-Beam, Reload → `mechanics-hold` (Cap 3, Safety-TTL, `releaseSpatialOneShotHandle`).
- **Tod:** `releaseActorCombatResources` → `suspendCombat` inkl. `hitscan.releaseAllEffects()`; Ripper/Shock-Scene-Dispose.
- **Explosionen:** Gain nahe Listener geduckt (Limiter-Schutz).

### 3. Load-Shedding bei Physik-Backlog — erweitert (Last-Rückkopplung-Failsafe)

`PhysicsStepBatch.loadShedNonCritical` — true wenn Physik **irgendwie** gedrosselt wurde:

- `physicsBacklogged` — Accumulator hat nach Substep-Cap noch ≥1 Step übrig
- Accumulator-Clamp in `accumulatePhysics` (Delta verworfen wegen `#activeMaxSubSteps`-Budget)
- Reduziertes Substep-Budget (`activeMaxSubSteps < max`) und volle Ausnutzung dieses Budgets

**Bots** (`loadShedNonCritical`): kein Brain-Tick, kein Route-Steer, kein Nav-Raycast, kein Jump-Ahead-Probe.

**Combat/VFX:** `tickAllWorldEffects(..., loadShedNonCritical)` → kein Flyby attach/sync, kein Rocket-Smoke/Trail-**Spawn** (Lifecycle-Ticks für Impact-Bursts, Flash-Sweep, Rocket-Smoke-Ablauf laufen **immer** — sonst Instanz-Leaks). Expanding-Lethal + Projektil-Physik laufen weiter.

**Flyby-Sync:** ab >14 Projektilen nur jedes 2. Projektil pro Frame (Round-Robin); bei Shed komplett aus.
- **Visibility:** `GameFrameClock` → `botRoster.resetVisibilityClock()` (Brain + Nav-Accumulator); Brain-Accumulator capped.

### 4. Zusätzlich

- **Render-Interpolation** (Player, Bots, Dynamic Instances).
- **Mechanics-Audio-Gate** via `needsMechanicsAudioTick()`.

### 5. Tod zentralisiert — Phase 1 ✓

**Modul:** `src/combat/actor-death-lifecycle.ts` — ein Eintritt `commitActorDeath()` für alle `alive → dead`-Übergänge.

```
health → 0
  └─ commitActorDeath(deathLifecycle, { actorId, faction, nowMs, source* })
       ├─ onActorDeathPhysics(actorId, nowMs)   ← syncActorDeathState sofort
       ├─ weapon.suspendCombat(nowMs)           ← einmal, nicht doppelt
       ├─ if (localPlayer) stabilizeCombatAudioAfterDeath(weaponAudio)
       └─ bus.emit('actor-died', { …, nowMs })
```

| Aufrufer | Pfad |
|----------|------|
| `apply-impact.ts` `damageActor` | Combat-Tod (Player + Bots) |
| `funnel-app.ts` nach `beginFrame` | Dev-`K` (`killPressed`, Snapshot noch nicht `applied`) |

**Entfernt / bereinigt:**

- Doppeltes `weapon.suspendCombat` in `funnel-app` `actor-died`-Listener und `humanoid-actor-tick.ts`
- Loop-Edge `lastLocalPlayerDead` (Roster/Downed nur noch über `actor-died`)
- `lastFrameNowMs`-Hack für Combat-Suspend beim Tod

**`actor-died`-Listener (`funnel-app.ts`)** — nur noch Match/UI: Roster, Stats, Downed-Index, Kill-Confirm, Match-Ende. Kein Combat/Audio mehr.

**`ActorDiedEvent.nowMs`** — Tod-Zeitpunkt im Event, nicht aus Loop-Closure.

**Wiring:** `ApplyImpactDeps.deathLifecycle` — shared `impactDeps` für `WorldProjectileSim`, `BotRoster`, `WeaponArsenal`; Closures über `player` / `weapon` / `botRoster` (late-bound, sicher ab Match-Start).

**Phase 2 offen:** `commitActorRevive` / `commitActorRespawn` — Revive/Hire/Auto-Spawn symmetrisch konsolidieren (`player-controller`, `bot-actor`, `revive-hire-channel`).

### 6. Spatial-Audio-Leak-Audit ✓ (2026-05-25)

**Anti-Pattern (entfernt):** Eigener `PannerNode` → `sfxInput`, looping Noise, kein Lease-Release → AudioContext-Akkumulation unter Dauerlast.

| Pfad | Vorher | Jetzt |
|------|--------|-------|
| Redeemer expanding blast | `AudioRedeemerImpact` (9 Nodes/Detonation) | `redeemer-blast` One-Shot-Lease |
| Bio RMB hold | Eigener Panner + 7 Nodes | `mechanics-hold` sustained lease |
| Pulse beam RMB hold | Eigener Panner + 8 Nodes | `mechanics-hold` sustained lease |
| Reload sequence | `context.createPanner()` + manuelles Disconnect | `mechanics-hold` + `track()` + TTL = reload-Dauer |

**Bewusst separat (OK):**

- **Flyby** — eigener gepoolter Slot-Graph (`audio-flyby-voice.ts`, Cap 24, `cleanupFlybyVoices`).
- **Hit/Kill-Confirm** — kurze non-spatial UI-SFX (~40–80 ms, self-stop, kein Hold).
- **Grunts/Pickups/Footsteps** — bereits `tryBeginSpatialOneShot`.

**API:** `audio-spatial-voice.ts` — `tryBeginSpatialOneShot`, `tryBeginSustainedSpatialVoice`, `releaseSpatialOneShotHandle`, `sweepExpiredSpatialOneShots`.

---

## Offen (falls Kernproblem bleibt)

| Punkt | Priorität |
|-------|-----------|
| Tod Phase 2 — `commitActorRevive` / `commitActorRespawn` | P1 |
| GC / unbounded Scene-Wachstum (Instancing-Pool-Audit) | P1 |
| Shared `WeaponAudio` pro Akteur refactoren (Cross-Actor-Mechanics) | P2 |
| Reload-Phase nach Tab-Suspend (`nowMs` vs `currentTime`) | P2 |
| Render-Interpolation auf Rotation erweitern | P3 |

---

## Verifikation

15v15 Pro-Roster, 10+ Min Dauerfeuer + Bewegung @ Max-Refresh:

- Kein Audio-Stottern (Phase 1)
- Kein FPS-Einbruch (Phase 2)
- Kein „alles langsam“ (Phase 3)
- Konsole ohne `[audio:KILLED]`

---

## Architektur-Zielbild (Referenz)

Strikte **Push-Struktur**: eine Frame-Uhr oben, alles Gameplay bekommt `frameNowMs` / `deltaSeconds` übergeben — nichts holt sich Zeit selbst.

```
rAF now
  └─ GameFrameClock → frameNowMs, deltaSeconds
       ├─ Input / Player / Bots (Gameplay)
       ├─ Physics accumulator → subSteps, physicsBacklogged, loadShedNonCritical
       ├─ Render interpolation blend
       ├─ Combat / Projectiles (#projectileTickNowMs) → commitActorDeath bei Kill
       ├─ tickFrameHousekeeping → tickGameAudio + segment TTL + world effects
       └─ performance.now() nur loopWallMs (FPS-HUD)
```

DSP bleibt auf `AudioContext.currentTime` — getrennte Domäne, kein Mischen in Gameplay-TTL.

---

## Debug-Checkliste (Konsole / DevTools)

**Bei Phase 1 (Audio-Stottern):**

1. `[audio:KILLED]` / `resume-failed`?
2. Active spatial leases / flyby slots nahe Cap (48 / 24)?
3. `mechanics-hold` oder `redeemer-blast` Leases ohne Release? (DevTools: Lease-Sweep)
4. Web-Audio-Thread vs. Main-Thread — wer spike't zuerst?

**Bei Phase 2–3 (FPS / alles langsam):**

5. `loadShedNonCritical === true` gehäuft? (nicht nur `physicsBacklogged`)
6. Main-Thread-Flame: Bots? `tickAllWorldEffects`? `render`? GC?
7. Scene-/Pool-Counts — wachsen sie über die Session?
