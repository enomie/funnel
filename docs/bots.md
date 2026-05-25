# Bots — Architektur & Player-Parität

Bots sind **Humanoids mit demselben Combat-/Anim-Stack wie der Player**. Unterschied: Input kommt aus `BotBrain`, nicht aus `InputState`.

## Stack (geteilt mit Player)

| Bereich | Modul |
|---------|--------|
| Waffen-Runtime | `WeaponArsenal` (Bot: `WEAPON_ARSENAL_BOT_BUDGET`) |
| Feuer-Intent | `fire-intent.ts` — `FireIntent`, `SecondaryHoldGates`, `applyCombinedSecondaryIntent` |
| Render-Tick | `humanoid-actor-tick.ts` — `tickHumanoidRenderFrame()` |
| Schaden | `apply-impact.ts` + `ActorRegistry` |
| Health / Tod | `PlayerHealth`, `actor-death.ts` |
| Locomotion FSM | `LocomotionAnimController` + `buildLocomotionAnimInput()` |
| Humanoid Physik | `humanoid-physics.ts` |
| Humanoid Visual | `humanoid-visual.ts` + `humanoid-visual-mount.ts` |
| Aim | `aimDirectionFromYawPitch`, `resolveMuzzleWorldPosition` |

## Bot-spezifisch

| Modul | Job |
|-------|-----|
| `bot-objective.ts` | **FIGHT > HUNT > PUSH** — Zielpunkt + aim (Druck ins Feindgebiet) |
| `bot-brain.ts` | 2 Hz think (M1 Chrome) → `BotBrainIntent` (`brainStepped` für Semi-Edges) |
| `bot-chase-drive.ts` | Sprint; Nav-Ray-Fans nur bei `stuckFrames > 0` |
| `bot-body-probe.ts` | Capsule-Shape-Cast + lokaler Headroom (Rain-Debris) |
| `bot-route-steer.ts` | Capsule-Detour wenn Zielrichtung blockiert (±38° Fan) |
| `bot-targeting.ts` / `bot-perception.ts` | Zielwahl, LoS |
| `bot-navigation*.ts` | Pfad-Cache |
| `bot-mobility.ts` | Vault / run-jump (Player-Parität) |
| `bot-respawn.ts` | Auto-Respawn 4 s |

### Mission (Priorität)

1. **FIGHT** — Gegner in Reichweite + LoS → stehen, schießen
2. **HUNT** — Gegner bekannt → sprint + nav, Blick auf Gegner
3. **PUSH** — sonst → tief ins **Feindgebiet** (`isInEnemyTerritory`); Gegner hinter uns → weiter PUSH, nicht zurück

PUSH/HUNT: immer **Sprint**; Hindernis → **run-jump** via Capsule-Cast (`bot-body-probe.ts` + `bot-mobility.ts`).

### Mobility — Capsule-Cast (Rain-Debris)

Freie Fahrt: Capsule-Cast zur **Zielrichtung**. Blockiert → **4 alternative Capsule-Casts** (±19°/±38°), bestes Alignment zum Gegner. Erst bei `stuckFrames > 0` schwere Nav-Fans.

| Probe | Wann | Zweck |
|-------|------|-------|
| 1× Capsule zum Ziel | immer (push/hunt) | Geradeaus oder Detour nötig? |
| 8× Fan + 2× Peel entlang Schräge | `pathBlocked` | Slanted debris — slide statt hängen |
| 1× Capsule moveYaw | moving | Jump-Fenster 0.52–0.92 m |
| Down + Up voraus | Jump-Kandidat | Tunnel meiden |

**Jump:** head-on Hit im Sprung-Fenster + Headroom ok → ein Sprint-Jump; **Vault-Latch** bis Weg ≥ 1 m frei.

Nav-Ray-Fans (`bot-navigation.ts`) nur bei **`stuckFrames > 0`** (harte Ecke).

## Actor-Schicht

```
BotActor
  ├── BotController     Rapier, drive, locomotionInput()
  ├── BotVisual         → HumanoidVisual
  ├── WeaponArsenal
  └── BotBrain          → fireIntentFromBrain(weapon, brainStepped)

Player (funnel-app)
  ├── PlayerController  finishFrame(..., weapon) → tickHumanoidRenderFrame
  ├── PlayerVisual      → HumanoidVisual
  └── WeaponArsenal
```

## Feuer — Parität

| | Primary | Secondary |
|--|---------|-----------|
| **Player** | `applyPrimaryFireIntent` (render) | `applyCombinedSecondaryIntent` + `secondaryHoldFromInput` |
| **Bot** | `applyPrimaryFireIntent` (fixed, pausiert während Bio/Rocket-Hold) | `applyCombinedSecondaryIntent` + `secondaryHoldFromBrain` |

Semi-Waffen: Bot feuert **einmal pro Brain-Tick** (`botFireGates`), nicht jeden Physics-Step — gleiche Feuerrate-Logik wie Spieler-Klicks.

Bio/Rocket Secondary: gleicher Hold→Release-Pfad wie Player RMB; Bot auto-release nach voller Charge bzw. 3 markierten Raketen.

## Bewusste Unterschiede (OK)

- VFX-Budget Bot (0 Lights, 8 Projektile)
- HUD / Kamera nur Player
- Footsteps nur Player
- Crouch nur Player-Input
- Respawn: Bot auto, Player `R`
- Redeemer guided: nur Player (Podium-Pickup + Kamera-Steuerung)
- Sniper Zoom: nur Player-FOV (kein Schaden)

## Verifikation

```bash
npm run lint && npm run build
```

Spiel: `K`/`R`, Bots schießen (Primary + Secondary inkl. Pulse-Beam, Rocket-Salve, Bio-Charge), Tod + 4 s Respawn. Rain-Match: Bots vaulten 1-m-Kisten schräg, weichen bei `stuck` seitlich aus.