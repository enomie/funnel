# Bots Verbesserungen und Rules für Bots

## Bot Improvements & Coding Rules
Our goal is to optimize and improve the code, not to make it more complex. We should always look for the most efficient and performant solution. When refactoring or changing existing code, let's seize the opportunity to improve it right away.

Please keep DRY (Don't Repeat Yourself) and KISS (Keep It Simple, Stupid) in mind—minimalistic, clean code is always better than overly long and complicated logic.

## Rules
- A - Bots dürfen nicht instant rotieren können, die sollen ein wneig menschliche Behäblichkeit haben. → `BotController`: `#aimYaw`/`#aimPitch` + `#yaw` per `lerpAngleRad` gegen Brain-Ziel (`BOT_TURN_SMOOTH_RATE`); Waffen/Fire nutzen smoothed aim, nicht raw Brain.
- B - Mindestens **0.5 m** Abstand zur Hülle von Hindernissen (`BOT_OBSTACLE_STANDOFF_M` → `BOT_OBSTACLE_STANDOFF_CENTER_M` in `bot-body-probe.ts`). Steer/Nav teilen `botWalkPathBlocked` + `botClearanceComfortT`. Vault-Fenster (`JUMP_WINDOW_*`) darf näher — nur zum Drüberspringen.
- C - Bot-Visual **einmal pro Render-Frame** nach `world.step` (`tickHumanoidRenderFrame`). Kein Visual in `fixedUpdate` / `preparePhysicsFrame`. Tote Bots mit `deathPoseSettled`: kein Mesh-/Eye-Sync. Aim-Pitch nach Locomotion via `PlayerAimSpine` (wie Player `updateAimSpine`). PUSH: `faceYaw = aimYaw` wenn `wantsFire`.

- D - **FIGHT** bei Reichweite + LoS auch während Reload — stehen bleiben, zielen; `wantsFire` nur wenn `canFirePrimary` (`resolveBotObjective`).

- E - **Stuck** = Velocity **oder** Positions-Anker **oder** Ziel-Fortschritt (`bot-controller.ts`): netto ≥0,28 m vom Anker; direkter Chase muss ≥0,14 m näher ans Ziel — Detour/Nav (`routeDetour`) unterdrückt Ziel-Check.

## CPU (ohne Funktionsverlust)
- Kein `FootstepController` / Grunts bei Bots (war nur Player laut `docs/bots.md`).
- Route-Steer skip bei `stuckFrames > 0` — Nav übernimmt ohnehin.
- Targeting: ein Kandidaten-Pass in `BotTargetFocus`; Snapshot-Key als String (+ alive-Count-Guard, int-Hash war buggy).
- Route-Steer: scratch-Arrays + `peelYawsInto` — kein per-frame `[]` alloc; Peel-Pick nutzt gecachte Clearances (kein zweiter Cast-Pass). Cruising: 0 Casts wenn Pfad klar + Ziel stabil (Phasen-Slot); Fan nur mit `tryAcquireRouteSteerFanRefresh` (Profil-Budget).
- `afterPhysics` skip für tote Bots.