# Jump (physics + Shooter-Pack clips)

Physics: `src/player/player-jump.ts` · clips + mesh/foot anchor below.

## Physics (`player-jump.ts`)

Gravity: `PHYSICS_CONFIG.gravity` (−32 m/s²). Vertical takeoff from target apex: `vy = √(2 · g · h)`.

| Style | When | Apex (m) | Takeoff planar | In air |
|-------|------|----------|----------------|--------|
| **idle** | Space only (no WASD) | 1.55 | ~6% of target — launch mostly vertical | **Height-gated thrust** forward along **view yaw** up to walk speed at apex; sliding carry retained at 92% |
| **walk** | WASD, no sprint-forward | 2.1 | Full wish velocity | Fixed — full takeoff inertia |
| **run** | Sprint + W | 2.85 | Full wish velocity | Fixed |
| **backward** | S (no W) | 1.85 | Full wish velocity | Fixed |

**Idle arc (design intent):** steep up first, then bend forward as height builds — thrust weight `(height / apex)²` during ascent only (`applyJumpAirThrust`); descent coasts with accumulated planar speed. No WASD air control on walk/run/backward jumps.

Tuning (module-local): `JUMP_TAKEOFF_PLANAR_SCALE` (0.06), `IDLE_JUMP_FORWARD_MPS` (= `walkSpeed`), `PLAYER_CONFIG.airAcceleration` (18 m/s²).

---

# Jump animations (Shooter-Pack)

## What Mixamo `jump-up` / `jump-down` actually are

They are **full in-place cycles** (start and end in the same standing pose), not separate “leave ground” / “touch ground” files.

| Clip | Duration | Hip height in DAE (before root strip) | Meaning |
|------|----------|----------------------------------------|---------|
| `jump-up` | ~0.53 s | Stand → **crouch** (~69 cm) → stand | Anticipation + push-off pose; the tail **stands up again on the spot** |
| `jump-down` | ~0.67 s | Stand hold → **drop + absorb** → stand | Idle on ledge / fall + **landing recovery** |

So they are **not** “play `jump-up` while airborne and `jump-down` when landing” as whole clips — the up clip already returns to stand before physics would finish the jump.

### Mesh vs capsule on landing

The **Rapier capsule** stays at the grounded center (physics). The **visible body** should dip like crouch when knees absorb impact:

1. **Hip position tracks are stripped** like other locomotion clips (no extra vertical root on top of the mesh).
2. **Foot anchor each frame** — during `jump-down-land` and `jump-up-takeoff`, lowest foot Y is sampled with `character.position.y = 0`, then the mesh is shifted once so feet meet the floor (`player-visual.ts`).
3. **Jump clips use a hard switch** (no crossfade) so idle + land poses are not blended — that blend looked like two characters stacked.

So the dip comes from the **animation values on the bones**, not from lowering the physics body.

## How Space jump uses them

| Phase | Clip | When |
|-------|------|------|
| Takeoff (W/S) | `jump-forward` / `jump-backward` | Directional jump |
| Takeoff (Space only / strafe) | `jump-up-takeoff` (subclip, first ~42% of `jump-up`) | Through deepest crouch / launch |
| Airborne | `rifle-aiming-idle` | Until landing |
| Land (always on voluntary touchdown) | `jump-down-land` — **crossfade in** from air idle | Always visible |
| Idle land, no WASD | play ~90% of subclip | Full knee absorb |
| Run/walk jump or WASD | after ~46% progress → **crossfade out** to walk/run | Knie sichtbar, keine lange Stand-Phase |

Subclips are built in `vertical-jump-subclips.ts` after all DAEs load.

## Future (not Space bar yet)

Full `jump-up` / `jump-down` are a good fit for **mantling** and **drop-from-ledge** once those mechanics exist — that matches Mixamo’s “up onto / down from” intent.
