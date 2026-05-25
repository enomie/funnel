# FUNNEL — Project Introduction & Architecture

Server is already running: http://localhost:3011/ 

---

## 1. Project Vision

**FUNNEL** is a state-of-the-art, high-speed arena shooter designed for the modern web browser. Inspired by the relentless pace and weapon variety of *Unreal Tournament 99*, the game drops players into a massive, claustrophobic industrial bottleneck where kinetic weapon physics, fully destructible environments, and a unique team-flipping recruitment mechanic collide.

The project pushes the absolute limits of web-based graphics and physics simulation, leveraging cutting-edge web standards to achieve deterministic, stutter-free gameplay at maximum refresh rates.

### Current Implementation Snapshot — 2026-05-22

The first playable foundation has now been migrated from the legacy reference demo in `docs/_examples/mTPS-game-sample` into the active Vite/TypeScript application. The old monolithic browser script has been replaced by focused ES modules under `src/`, using current project dependencies instead of bundled legacy scripts or CDN imports.

The local development server is already running at:

* **Dev URL:** `http://localhost:3011/`

Implemented starting point:

* WebGPU-first Three.js renderer via the project `three/webgpu` alias.
* Rapier SIMD physics runtime via `@dimforge/rapier3d-simd-compat`.
* 50m x 300m x 50m funnel arena shell with fixed colliders.
* Instanced pillar visuals with matching fixed Rapier cylinder colliders.
* Dynamic physics crates synchronized from Rapier to Three.js through `src/physics/synced-body.ts`.
* Player capsule controller with WASD, mouse look, jump buffering (coyote), sprint, and **hold-to-crouch**; **no WASD air control** on walk/run jumps — planar velocity fixed at takeoff; **stand jump** thrusts forward along view yaw as height builds (`docs/jump-animations.md` § physics).
* Physics loop: input/jump once per frame, movement in Rapier fixed substeps, ground reconcile after `world.step` (`player-controller.ts`, `funnel-app.ts`).
* World gravity `PHYSICS_CONFIG.gravity` (−32 m/s²); jump apex and idle forward arc tuned in `player-jump.ts` (walk / run / idle / backward).
* **Camera:** default **third person** (`PLAYER_CONFIG.thirdPersonDistance`, shoulder offset); **RMB** = **first person** aim (crosshair, viewmodel on `fps-viewmodel-rig` in scene). Line-of-sight pull-in only if geometry blocks camera → player (`player-camera.ts`). Hitscan/tracers use view forward; muzzle from camera in FP, socket in TP.
* Shooter-Pack Collada character (`public/Shooter-Pack/animation-model-y-bot.dae`) with **16 external animation clips** loaded via ZIP-aware Collada pipeline (`src/player/shooter-pack-loader.ts`).
* Locomotion FSM (`locomotion-anim-controller.ts`): walk/run/back/strafe/**2D blend** (diagonal = forward + strafe weights); jump/fire/death; `crouch-idle` while crouched; fire as upper-body overlay (`collada-upper-body-clip.ts`).
* Crouch (`player-stance.ts`): hold `C` on ground (also while moving — brakes to stop); release `C` to stand; half-height capsule, body snap to ground, mesh foot anchor from clips (`player-mesh-foot-anchor.ts`); `crouchCameraHeight`; no WASD while ducked.
* Stride sync: animation `timeScale` tied to capsule speed and `PLAYER_CONFIG` (`locomotion-stride-sync.ts`, `npm run check:stride-sync`).
* Procedural footstep and landing sounds (`footstep-audio.ts`, `footstep-controller.ts`) on shared `FunnelAudioContext` SFX bus — no sample files yet; material tags (Concrete/Metal/…) planned.
* Spatial weapon audio: Fire/Impact/Fly via `PannerNode` + camera `AudioListener` (`src/audio/`, spec `docs/audio.md`); procedural; Doppler on fly via pitch fallback when browser lacks panner velocity.
* Procedural weapon placeholder boxes driven by per-weapon dimensions and colors (unchanged until weapon meshes return).
* Selectable 10-slot projectile weapon prototype with ray-step collision, color-coded projectile meshes, additive fake glows, pooled projectile point lights, throttled trails, **unified impact bursts** (`projectile-impact-visual.ts`, `docs/visual-effects.md`), spatial procedural shot/impact/fly audio (`docs/audio.md`, ~320 m audibility), Ripper wall ricochet (physics + smaller burst/sound), and build-piece damage.
* In-game build prototype for walls, floors, ramps, and cones with grid snapping, preview meshes, occupied-cell checks, fixed Rapier colliders, and destructible health.
* Lightweight HUD/crosshair/status-toast layer with live weapon readout, **faction team badge** (Team Alpha / Team Beta), and pointer-lock input handling.
* Two-faction team foundation (`Team Alpha`, `Team Beta`) with viewer-relative colors (allies **blue**, enemies **red**), local player always ally-tinted, dev `T` flip for hire prep, and **full dev bot roster** (Pro: **14 allied + 15 enemy** bots, idle `rifle-aiming-idle`) cloned from one Shooter-Pack load — see `docs/team-design.md` for styling rules and the **15 members per team** target (`match-roster.ts` + `chrome-macos-arm-profile.ts`).
* Actor ground anchor: `PLAYER_GROUNDED_CENTER_Y` in `game-config.ts` aligns capsule center with arena floor (player + bot roots); mesh foot offset matches `player-visual` / `bot-placeholder`.

How to exercise the current playable slice:

* Open `http://localhost:3011/`.
* Click the arena or press `P` for pointer lock.
* Move with `WASD`, sprint with `Shift`, jump with `Space`.
* **Hold `C`** to crouch (works while running — you stop in place); release `C` to stand.
* **Hold `RMB`** for first-person aim (crosshair); release for third person behind the player.
* Fire with `LMB` (direction = current view).
* Select weapons with `1` through `0`.
* Enter build mode with `Q` wall, `Z` floor, `V` ramp, or `Tab` cone; place the preview with `LMB`; return to weapon mode with `F`.

* [x] Initialize repository with WebGPU and Rapier.js dependencies.
* [x] Set up deterministic main game loop core.
* [x] Migrate the old mTPS playable foundation into modular Vite/TypeScript code.
* [x] Faction team model (`alpha` / `beta`), HUD badge, ally/enemy color constants, `PlayerTeam` + dev `T` flip (hire prep).
* [x] Dev bot placeholders for team styling (`bot-placeholder-roster`, `match-roster`, shared Shooter-Pack clone).
* [ ] Expand the playable slice into the full team/bot combat loop (AI, physics, team damage, stable **15v15** roster).

---

## 2. Tech Stack & Architecture (State-of-the-Art 2026)

To guarantee uncompromising performance, zero stuttering, and AAA-grade visual effects directly in the browser, the architecture relies on a strict separation of concerns utilizing the newest web standards.

```
       +---------------------------------------------------+
       |                    GAME LOOP                      |
       |         (Orchestration & State Management)        |
       +-------------------------+-------------------------+
                                 |
                +----------------+----------------+
                |                                 |
                v                                 v
    +-----------------------+         +-----------------------+
    |   PHYSICS ENGINE      |         |   GRAPHICS ENGINE     |
    |  Rapier.js (SIMD)     |         |  Three.js (WebGPU)    |
    |                       |         |                       |
    | - Hitbox Calculation  |         | - TSL Shaders         |
    | - Ragdoll Simulation  |         | - Dynamic Lighting    |
    | - Kinetic Force Trans.|         | - GPU Particle FX     |
    +-----------------------+         +-----------------------+

```

### Graphics: Three.js (WebGPU & TSL)

* **WebGPU Native:** Explicit GPU control drastically reduces CPU overhead and draw-call bottlenecks.
* **Three.js Shading Language (TSL):** Environmental lighting, complex weapon FX, and procedural tunnel structures are calculated directly on the GPU using TSL, keeping the main loop lightweight.
* [x] Configure Three.js WebGPU renderer pipeline.
* [x] Configure WebGPU-compatible lighting, tone mapping, shadows, fog, and relative asset deployment.
* [ ] Implement base TSL material structure for custom pipeline shaders.

### Physics: Rapier.js (SIMD)

* **SIMD-Accelerated WASM:** Utilizing Rapier’s SIMD features for hyper-fast, parallelized physics calculations.
* **Arcade Controller, Realistic Environment:** The character controller prioritizes responsive, snappy, non-realistic movement for arcade precision, while weapon impacts, structural destruction, and ragdolls follow strict physical laws.
* **Perfect Hitboxes:** Hit registration is decoupled from visual meshes and calculated via Rapier's high-performance colliders to ensure pixel-perfect detection at high speeds.
* [x] Compile and integrate Rapier.js SIMD WASM instance.
* [x] Create decoupled physics-to-render transform synchronization layer.
* [x] Use Rapier ray casts for third-person line-of-sight camera clamp and projectile collision.

### Architecture Principle: The Orchestration Loop

The central JavaScript game loop does no heavy rendering or physics calculations. It acts strictly as an **orchestrator**, updating the state, dispatching inputs to Rapier, and letting WebGPU handle the rendering pipelining natively. This guarantees an uninterrupted, stutter-free loop.

* [x] Implement fixed-step physics accumulator with capped sub-steps.
* [x] Route per-frame input, camera, player, building, weapon, physics, and render updates from `src/app/funnel-app.ts`.
* [ ] Add frame-independent render interpolation layer.

---

## 3. Code Architecture & Modularity

### Single-Responsibility Principle (SRP) & Extreme Modularization

The project follows a strict separation of concerns. Instead of monolithic classes or bloated files, the codebase is broken down into **many small, highly focused modules (files)**. Each file is exclusively responsible for a single, clearly defined task (e.g., one module purely for calculating a primitive's rigid-body setup, another for spawning gib particles). This minimizes side effects, enhances testability, and secures maintainability as the game loop complexity grows.

* [x] Establish folder structure enforcing isolated functional domains.
* [x] Add `npm run lint` for the active `src/` tree.
* [ ] Add an explicit module-size/code-boundary check to prevent monolithic file growth.

### Co-Location of Configurations (Top-of-File Configs)

To eliminate the overhead of messy global configuration files, the principle of **co-location** is applied. Local parameters, tuning values, or system-specific constants (such as a pillar's mass or a shotgun's spread) are **declared directly at the very top of their respective functional module as constant variables**.

* **Advantage:** Developers instantly see all mechanical tuning dials upon opening a file, without switching back and forth between config directories and implementation code.
* **Architectural Rule:** If a configuration value is strictly required by more than two independent subsystems, it is exported via a dedicated, lightweight shared constants module to respect the DRY (*Don't Repeat Yourself*) principle.
* [ ] Define boilerplate template for modules including the `Top-of-File Config` block layout.

---

## 4. Project Resources & Demo Migration

### Reference Demo & Asset Migration

The repository contains a functional reference prototype located in `docs/_examples/mTPS-game-sample`, which serves as the foundational blueprint for the character controller and responsive movement mechanics. While the core control logic is fully intact, the project modules are outdated and will be refactored to align with the modern WebGPU/TSL stack.
The first migration pass moved gameplay logic from `docs/_examples/mTPS-game-sample` into modular Vite/TypeScript under `src/`. Character assets initially lived in `public/model/` (legacy FBX from the demo). **The next asset pass replaces that character stack with Mixamo Shooter-Pack Collada files in `public/Shooter-Pack/`.**

The new entrypoint is `src/main.ts`, with separate modules for DOM setup, renderer creation, scene creation, input, physics, arena construction, player control, camera, combat, and building.

* [x] Audit and extract control system math from the mTPS sample code.
* [x] Replace legacy demo globals with modular Vite/TypeScript code.
* [x] Serve the migrated playable slice through Vite on port `3011`.
* [x] Replace old CDN/demo dependencies with project-managed Vite, Three.js WebGPU, and Rapier SIMD imports.
* [ ] Continue refining demo parity: build placement edge cases, per-material footstep/impact audio, bot locomotion parity.

### Character assets: Shooter-Pack Collada (active migration — 2026-05-22)

**Goal:** Stop using `public/model/mSet14.fbx` (and its embedded animation clips) for the player/bot rig. Use **one base mesh** plus **one Collada file per animation**, all under `public/Shooter-Pack/`.

**Naming convention (on disk):** lowercase only, no spaces (hyphens instead), every file prefixed with `animation-`, extension `.dae`. The base rig follows the same prefix for consistency: `animation-model-y-bot.dae`.

| Role | Path |
|------|------|
| Base mesh (Y-Bot + skeleton) | `public/Shooter-Pack/animation-model-y-bot.dae` |
| Rifle aim idle | `public/Shooter-Pack/animation-rifle-aiming-idle.dae` |
| Rifle fire | `public/Shooter-Pack/animation-firing-rifle.dae` |
| Rifle run | `public/Shooter-Pack/animation-rifle-run.dae` |
| Walk | `public/Shooter-Pack/animation-walking.dae` |
| Walk start / stop | `public/Shooter-Pack/animation-start-walking.dae`, `public/Shooter-Pack/animation-stop-walking.dae` |
| Walk backward / start / stop | `public/Shooter-Pack/animation-walking-backwards.dae`, `public/Shooter-Pack/animation-start-walking-backwards.dae`, `public/Shooter-Pack/animation-walk-backwards-stop.dae` |
| Run backward | `public/Shooter-Pack/animation-run-backwards.dae` |
| Strafe L/R (two clips) | `public/Shooter-Pack/animation-strafe.dae`, `public/Shooter-Pack/animation-strafe-2.dae` |
| Jump forward / backward | `public/Shooter-Pack/animation-jump-forward.dae`, `public/Shooter-Pack/animation-jump-backward.dae` |
| Death from walk | `public/Shooter-Pack/animation-walking-to-dying.dae` |

**Loader design (to implement):**

1. Load `animation-model-y-bot.dae` once → skinned mesh + skeleton bound to the player scene graph.
2. Load each `animation-*.dae` (except the base file) as **animation-only** payloads; extract `AnimationClip`(s) and register them by normalized clip id (filename without prefix/extension).
3. Retarget or validate bone names against the base skeleton before mixing (Collada + separate files often duplicate armature nodes per file).
4. Keep the existing `AnimationMixer` state machine (`state → clip fallback lists`, crossfades, one-shot jumps) but remap states to the new clip ids (e.g. locomotion → `walking` / `rifle-run`, combat idle → `rifle-aiming-idle`, fire → `firing-rifle`, death → `walking-to-dying`).
5. Remove runtime dependency on `mSet14.fbx` / `Scar_L01.fbx` for the local player once parity is verified; leave `public/model/` in the repo only until the Collada path is default.

**Docs refresh after first Collada load:** regenerate `docs/animations.txt` and `docs/bones.txt` from the new assets (clip names, durations, bone hierarchy on `animation-model-y-bot.dae`).

* [x] Import Shooter-Pack assets into `public/Shooter-Pack/` and normalize filenames (`animation-*`, lowercase, no spaces).
* [x] Add Collada loader modules under `src/player/` (`collada-zip`, `collada-asset-loader`, `shooter-pack-loader`, `animation-clip-registry`, `collada-animation-remap`).
* [x] Wire player spawn to `animation-model-y-bot.dae` instead of `mSet14.fbx`.
* [x] Locomotion FSM + stride sync + jump/landing audio (`docs/umsetzung.md` Phase 3 + 6).
* [x] First-pass state → Shooter-Pack clip mapping in `player-visual.ts` (all 15 clips registered).
* [ ] Re-enable interruptible start/stop walk transitions; per-surface footstep samples.
* [x] Re-run bone/animation inspection — `npm run inspect:shooter-pack` → `docs/animations.txt` / `docs/bones.txt`.
* [x] Auto-discover Shooter-Pack animations via `import.meta.glob` (`shooter-pack-manifest.ts`).
* [x] Death animation prototype (`walking-to-dying`, `K`/`R` test keys, `player-health.ts`).
* [ ] Wire player damage from weapons/bots; expand animation for downed, revive, hire states.

### Character Model & Animation Parsing (legacy FBX — superseded)

The first playable slice used **`mSet14.fbx`** from `public/model/` with **embedded** animation clips inside a single container. That path is **frozen**: new work targets Shooter-Pack Collada only.

Historical FBX inspection (for comparing old clip names during migration):

* `docs/animations.txt` — legacy embedded FBX clips from `mSet14.fbx`.
* `docs/bones.txt` — legacy hierarchy from `mSet14.fbx`.

* [x] Load `mSet14.fbx` and `Scar_L01.fbx` asynchronously from `public/model/` (legacy).
* [x] Log FBX hierarchy, meshes, bones, skeletons, and embedded animation tracks in the browser console during asset loading.
* [x] Store inspected animation and bone results in `docs/animations.txt` and `docs/bones.txt`.
* [x] Implement first WebGPU-compatible animation routing layer with `AnimationMixer`, state-to-clip fallback lists, crossfades, and one-shot jump handling.
* [x] Prepare slide animation routing for the later movement implementation (no Shooter-Pack slide clip yet — keep fallback or add clip later).
* [ ] Complete Shooter-Pack Collada migration (see checklist above).
* [x] Diagonal locomotion blend (forward + strafe layer weights in `locomotion-blend.ts`).
* [x] Hold-to-crouch with `crouch-idle` clip and grounded capsule snap (`player-stance.ts`).
* [x] Third-person / first-person camera split on `RMB` (`player-camera.ts`).
* [ ] Expand animation blending for combat, damage, downed, revive, hire, and bot states.
* [ ] UT-style **RMB alt-fire** per weapon (today RMB = aim down sights / first person only).

### Player camera & stance (implementation)

| Mode | Input | Camera | Character / weapon |
|------|--------|--------|-------------------|
| Third person | RMB released | Boom behind player on XZ (`thirdPersonDistance` in `game-config.ts`), looks at aim pivot | Full body visible; weapon socket on `player-visual` root (hidden) |
| First person | RMB held | Eye at `cameraHeight` / `crouchCameraHeight`; rotation = mouse yaw/pitch (`lookAt` along view forward) | Body hidden; procedural weapon mesh parented to scene `fps-viewmodel-rig` synced to camera |

Tuning: `PLAYER_CONFIG.thirdPersonDistance`, `cameraHeight`, `crouchCameraHeight`, `cameraSide`; FP weapon local offsets in `player-camera.ts` (`FIRST_PERSON_WEAPON_OFFSET`).

**Crouch:** `canEnterCrouch` while `C` held and grounded; sprint + `C` zeros horizontal velocity then plays `crouch-idle`. Capsule halves height (centered collider + ground ray snap). Jump or release `C` calls `standFromCrouch`.

---

## 5. Core Gameplay Mechanics

### The Map: The Funnel

The entire game takes place within a single, massive geometric corridor measuring **50m wide, 300m long, and 50m high**.

* Two teams spawn at opposing ends of this tunnel.
* The center of the funnel is packed with physics-driven infrastructure: pillars, blocks, and modular buildings assembled from individual components.
* [x] Build the static outer shell enclosure matching the exact dimensions.
* [x] Add first-pass physics infrastructure and instanced pillar layout.
* [x] Add first-pass ceiling emissive tubes, grid helper, dynamic crates, and industrial placeholder materials.
* [ ] Replace placeholder arena dressing with final industrial art direction.

### UT99-Inspired Arsenal

Weapons are high-impact, offering distinct tactical utility and dual firing modes:

* **Hitscan & Projectile Hybrid:** A deliberate mix of instant-hit weapons (precision rifles) and physics-based projectiles (bouncing flak, rockets) that transfer true kinetic force.
* **Secondary Fire:** Every weapon features a mandatory alternative firing mode to completely change its behavior (e.g., single rocket vs. loaded volley/grenades).
* **Kinetic Momentum:** Gunfire directly transfers energy to the environment. Shooting structures shatters them, dynamically altering cover and sightlines.

The active implementation now lives in `src/combat/weapon-definitions.ts`, `src/combat/weapon-arsenal.ts`, `src/combat/projectile-visuals.ts`, and `src/combat/projectile-impact-visual.ts`. It provides selectable prototype versions of all planned weapon slots, but currently only the primary fire channel is wired. Each weapon definition owns its display color and placeholder dimensions (`width` X, `length` Z, `height` Y), and the same color drives projectile meshes, trails, impact bursts, fake glows, and the capped projectile light pool. Impacts use a shared expanding-sphere burst scaled by `impactRadius`; Ripper ricochets reflect velocity off Rapier normals (up to three wall bounces). Projectiles are ray-stepped through Rapier to avoid tunneling and removed on final hit.

* [x] Code first weapon definition layer for slots `1` through `0`.
* [x] Implement primary-fire projectile spawning, spread handling, trails, unified impact bursts, and spatial procedural audio cues.
* [x] Replace the single weapon FBX with per-weapon colored box placeholder meshes showing external dimensions.
* [x] Add optimized projectile glow rendering using additive fake-glow meshes plus a capped reusable point-light pool.
* [x] Add FPS-oriented projectile cleanup and allocation controls: cached color materials/geometries, throttled trail spawning, and non-shifting temporary-object cleanup.
* [x] Bind weapon impacts to build-piece damage/destruction.
* [ ] Add formal weapon entity abstraction supporting `primaryFire()` and `secondaryFire()`.
* [ ] Implement bot/player health, team damage, headshot multipliers, splash radius, and kinetic impulse transfer.

### 15 vs. 15 Dynamic "Hire" System

Matches consist of two teams of **15**. In single-player/hybrid modes, the game orchestrates **1 player + 14 allied bots** against **15 enemy bots**. **15 members per team side is the Pro bar** — stutter-free at max refresh with the full roster is the default success criterion (`playersPerTeam: 15` in `chrome-macos-arm-profile.ts`, all runtime profiles).

* **Ragdoll State:** When a player or bot dies, they drop as a persistent physical body.
* **Revive:** Teammates can interact with the fallen body to revive them back into their original team.
* **The "Hire" Twist:** Enemies can approach a fallen player and "hire" (recruit) them. The character revives instantly but permanently **switches sides**, turning the match into a volatile, tug-of-war battle for manpower.
* [ ] Implement bot AI behavior tree capable of navigation, combat decision-making, and tracking downed actors.
* [ ] Set up interactive "Revive" and "Hire" casting timers on downed character collision objects.

---

## 6. Lighting & Material Architecture

### Dynamic Tunnel Illumination

The lighting setup within the funnel balances industrial grit with high-performance execution.

* **Linear Ceilings (Neon Tubes):** The primary ambient illumination comes from rows of fluorescent neon tubes running along the ceiling. These are driven by emissive TSL materials combined with optimized line-light approximations to cast realistic, wide-sweeping luminance across the concrete walls.
* **Tactical Spotlights:** High-intensity directional spotlights are placed strategically throughout the arena to create dramatic cone highlights, deep shadows, and clear visibility zones for fast-paced combat. All lights are tied into the WebGPU clustered shading pipeline to allow dozens of concurrent light sources without performance drops.

Current lighting is implemented with standard Three.js WebGPU lights and emissive meshes: ambient light, a directional key light with shadows, ceiling tube meshes, a player-following spotlight rig, and a small reusable projectile point-light pool. Projectile visibility is mostly handled through cheap color-coded meshes, additive fake-glow meshes, and short-lived trail lines, keeping the number of real dynamic lights capped during sustained fire.

* [x] Add first-pass dynamic tunnel lighting with ceiling emissive tube meshes and a player-following spotlight.
* [x] Add capped projectile lighting and fake-glow visuals without spawning one real light per projectile.
* [ ] Author custom TSL emissive line-light shader pipeline.
* [ ] Integrate WebGPU clustered shading setup for high-density spotlight distribution.

### Physically-Based Materials & Audio-Physical Tags

To achieve a tactile, heavy atmosphere, all surface shaders leverage WebGPU PBR (Physically-Based Rendering) with fine-tuned roughness, metalness, and emissive maps (e.g., matte concrete dust, glossy weapon metal, glowing energy panels).
Crucially, environmental materials are tagged with specific physical attributes (**Concrete, Metal, Wood, Grass**). These tags are read dynamically by the game loop to determine two critical systems:

* **Acoustics:** Footsteps/landings procedural on SFX bus (`footstep-audio.ts`); weapons spatial Fire/Impact/Fly (`docs/audio.md`). Per-surface material tags (Concrete, Metal, Wood, Grass) for impact EQ/samples are planned.
* **Mass & Physics:** The material tag defines the mass, friction, and restitution (bounciness) of the rigid bodies in Rapier.js. A metal girder react with immense weight and slam heavily into a wooden crate, splintering it with proportional kinetic force.
* [x] Implement procedural weapon shot/impact audio (legacy mono).
* [x] Spatial 3D weapon audio (listener at camera, Panner at muzzle/hit/projectile; fly pool + Doppler pitch fallback).
* [ ] Implement lookup mapping system binding physics identifiers to audio trigger cues.
* [ ] Setup Rapier physics material preset blueprints corresponding to target friction/density values.

---

## 7. Expanded Weapon Arsenal & Gore System

### UT99-Inspired Weapon Mechanics

The sandbox features a highly specialized, combat-tested arsenal directly paying homage to *Unreal Tournament 99*. Every weapon is designed around risk-reward dynamics and features two distinct firing modes via Left-Click (LMB) and Right-Click (RMB):

* **The Shock Blaster (Combo Rifle):**
* *LMB:* High-speed, precise energy beam (Hitscan).
* *RMB:* Fires a slow-moving plasma sphere that expands in size during flight (proportional damage drop-off, but covers a wider area).
* *The Combo:* Shooting the flying plasma sphere with the LMB beam triggers a massive, devastating shockwave explosion dealing critical area-of-effect damage.


* **Rocket Launcher (Multi-Loader):**
* *LMB:* Launches a single, high-velocity rocket.
* *RMB:* Holding the button loads and bundles up to 5 rockets simultaneously, releasing them in a tight horizontal spread or a spiral volley upon release.


* **The Ripper (Razor Disk Launcher):**
* *LMB:* Fires high-speed, spinning razor disks that ricochet off the funnel's walls up to 3 times, slicing through enemies and traveling until they impact a target.
* *RMB:* Launches an explosive disk that detonates on immediate contact with any surface.


* **Traditional Arsenal:** Includes the **Sniper Rifle** (hitscan, lethal headshot multipliers), **Shotgun/Flak** (unforgiving close-range spread with bouncing shrapnel), **Gatling / Heavy MG** (sustained, high-rate-of-fire suppression), and a reliable, precise **Pistol** fallback.

The prototype arsenal already includes Pistol, Shock Blaster, Rocket Launcher, Ripper, Flak Cannon, Sniper Rifle, Gatling, Pulse Lance, Bio Lobber, and Redeemer Seed definitions. Their visuals use lightweight Three.js primitives with weapon-specific projectile silhouettes. **LMB/RMB** are differentiated per slot (hitscan, combo, magazine rockets, ricochet, flak grenade, zoom, charge blob, guided nuke, etc.) — see `docs/weapons.md`. Impacts are still **Audio/VFX only** until `applyImpact` lands.

* [x] Build selectable first-pass arsenal covering all 10 number-key weapon slots.
* [x] Build projectile visual primitives for pistol, shock, rocket, ripper, flak, sniper, gatling, pulse, bio, and redeemer shots.
* [x] Build custom projectile collision handler managing up to 3 surface ricochets for the Ripper.
* [x] Program the Shock Combo tracking listener to detect raycast intersection with the floating plasma ball entity (`shock-combo.ts`).
* [x] Code the multi-rocket sequential queuing system for the Rocket Launcher RMB channel (`rocket-launcher.ts`; 6er-Magazin + Hold→Release Salve).

### Gibs & Advanced Gore System

To complement the hard-hitting weapon physics, deaths are violent and visceral. When a player or bot takes damage far exceeding their health threshold (e.g., a direct rocket blast or a localized Shock Combo), the system switches from a standard Rapier ragdoll to a **Gore/Gib-System**.

* The character mesh is instantly hidden and replaced by separate physical "gibs" (flesh, limbs, mechanical parts) calculated as individual rigid bodies in Rapier.js.
* GPU-driven blood particles (simulated via TSL shaders) spray dynamically, staining the concrete walls and floor of the funnel based on the impact vector.
* [ ] Develop physical gib fracturing system replacing actor meshes upon high-damage thresholds.
* [ ] Write a high-performance GPU compute particle system in TSL for blood projection and permanent surface decals.

---

## 8. Team Identification & Visual Clarity

### The Absolute Color Rule

In the chaotic, high-speed environment of the funnel, instant target recognition is critical. The game enforces a strict, unyielding color coding system for team identification, regardless of which side the player originally spawns on:

* **The Allied Team (Your Side):** Always rendered in distinct **BLUE** suit highlights, team icons, and UI markers.
* **The Enemy Team (The Opponents):** Always rendered in aggressive **RED** suit highlights and UI indicators.

### Dynamic Color Swapping (The Hire System)

When a fallen body is successfully "hired" and switches teams, its emissive suit textures and UI tags instantly transition from Blue to Red (or vice versa). This visual flip is managed seamlessly via WebGPU instance attributes, providing immediate tactical feedback to all players in the arena.

* [x] Faction definitions, viewer-relative ally/enemy palette, `team-visual-colors.ts` material tinting, HUD team badge (`src/combat/teams.ts`, `src/player/player-team.ts`, `src/ui/team-hud.ts`).
* [x] Dev `T` key flips local faction (`PlayerTeam.flip`) — same code path future **Hire** will call with `reason: 'hire'`; placeholder bots re-tint via `BotPlaceholderRoster.refreshViewerColors()`.
* [x] Styling bots: cloned Y-Bots with idle pose, viewer-relative blue/red (`src/combat/bot-placeholder*.ts`, `src/player/shooter-pack-clone.ts`). Design spec: `docs/team-design.md`.
* [ ] Segment vs. joint emissive layers and per-instance material clones (see `team-design.md` §4).
* [ ] Create uniform-controlled PBR shaders exposing dynamic emissive team color swaps (instance attributes for many bots).
* [ ] Wire team swap on hire/revive for simulated actors (Rapier ragdoll + timers).

---

## 9. Pickup System & Tactical Arena Editor

### In-Game Pickups

To maintain the high-speed arena flow, **health packs** and **shield belts** drop from the rain band at match start (same air-drop model as countdown debris), tumble on Rapier physics, and **instantly respawn in the air** when collected — fixed pool size per match. See [`environment-dynamic.md`](environment-dynamic.md) § Pickups · `src/arena/pickup-field.ts`.

* **Meds:** Health boxes (**1 × 0.5 × 1** m, green `#58ffb0`) — +25 HP.
* **Shield belts:** Glowing spheres (cyan `#58d6ff`) — +50 shield.
* **Ammunition:** Specific ammo boxes tailored to weapon classes (Rockets, Razor Disks, Energy Cells) — planned.
* **Weapon Spawns:** Static spawn points where advanced weapons respawn on a strict global timer — planned.
* [x] Proximity collection for health + shield (player + bots).
* [ ] Code global timed-respawn manager for premium weapons.

### Embedded Arena Editor & Dynamic Instancing

To construct and test various funnel layouts, the project features an integrated **Level Editor**. By default, it generates the basic tunnel enclosure, but allows real-time modification of the core dimensions (Width, Length, Height).
Within this tunnel, developers can place, scale, rotate, and deform all classic geometric primitives supported by both Three.js and Rapier.js:

* **Primitives Library:** Cubes (stretched into walls/pillars), Spheres, Cylinders, Cones, Toruses, and Capsules.
* **Performance-First Instancing:** To ensure the game loop remains absolutely flawless and stutter-free, the editor automatically groups identical geometric shapes into WebGPU **Instanced Meshes**. Instead of drawing hundreds of individual pillars and dragging down performance, WebGPU renders them in a single, ultra-fast draw call.
* **Rapier Binding:** When a primitive is placed or scaled in the editor, a corresponding Rapier.js rigid body collider (with matching dimensions and material mass tags) is instantly baked into the physics world.
* [x] Write first playable build overlay through keyboard-selected primitive placement.
* [x] Create first static WebGPU instancing pass for repeated arena pillars.
* [x] Add grid-snapped build previews, occupied-placement blocking, fixed Rapier colliders, and destructible build health.
* [ ] Write level editor UI overlay with coordinate manipulation controls.
* [ ] Create dynamic WebGPU auto-instancing system matching primitive types.
* [ ] Build JSON exporter/importer pipeline saving custom map structures.

---

## 10. Loading Phase & Match-Start Sequence

### Asynchronous Asset Loading & Error Tracking

Due to large file payloads (e.g., the Shooter-Pack base mesh `animation-model-y-bot.dae` ~8MB plus per-animation `.dae` files, heavy textures, and raw audio files), the project relies on a highly transparent, robust **Loading Screen** subsystem. It intercepts the loading queue asynchronously and surfaces feedback:

* **Progress Tracking:** A granular mathematical progress bar shows download percentage alongside live text logging displaying exactly what asset (mesh, TSL shader chunk, sound pack) is currently initializing.
* **Validation & Error Handling:** Every asset undergoes integrity evaluation immediately following resolution. If a network drops or a file returns corrupted, the loader prevents silent hangs, exposing a detailed error console with a clear code and file path string for diagnostic efficiency.
* [ ] Program centralized asset loader managing explicit download progress event triggers.
* [ ] Implement runtime file health validation checks with non-blocking error interface layers.

### Match Countdown & Audio Orchestration

Once all active resources settle natively within the WebGPU buffer spaces and Rapier context fields, the loading display transitions away to initiate the pre-match tactical setup:

* **The 10-Second Countdown:** Input locked while **every actor drops from the air in the match-start band** — **15 m** deep, starting **30 m** from the bulkhead (`z ±105…±120` for beta/alpha), **in front of** the spawn shield cubes (which occupy the **15…30 m** band). Death respawn uses only the **last 15 m** at the bulkhead (`z ±135…±150`). See [`environment.md`](environment.md) § Spawn-Logik.
* **Acoustic Synthesis:** Every tick of the count triggers an exact, mechanical sound cue. As the clock strikes zero ("0"), input blocks vanish, a loud match initialization sound is dispatched, and ambient industrial audio loops kick off along with the game's music score.
* [ ] Build player control lock/unlock flag layers tied to match clock updates.
* [ ] Code audio scheduler syncing localized ticks and background loop launches.


Ich habe nach UT99 geschaut. Die offizielle GOTY-Manual beschreibt ziemlich klar: Shock = Beam/Orb/Combo, Ripper = ricochet blades/exploding blades, Sniper = shot/zoom, Minigun = genauer/schneller ungenauer, Redeemer = nuke/guided nuke, Flak = shrapnel/grenade, Bio = kleine Sludge-Clumps/aufgeladener großer Blob, Pulse = plasma bursts/steady stream. Quelle: [UT GOTY Manual PDF](https://www.mogelpower.de/manuals/Unreal_Tournament_Game_of_the_Year_Edition_Manual_Englisch.pdf). Für Rocket ist zusätzlich wichtig: UT99 konnte Raketen aufladen, Spread/enge Formation und Homing-Lock; siehe auch [GameFAQs UT99 weapon FAQ](https://gamefaqs.gamespot.com/pc/191945-unreal-tournament-1999/faqs/6426).

Mein Vorschlag für FUNNEL:

| Slot | Waffe | LMB | RMB |
|---|---|---|---|
| `1` | Pistol | präziser Semi-Auto-Schuss | schneller Fächer/Burst, weniger genau |
| `2` | Shock Blaster | instant Beam | langsame Shock-Orb; Beam trifft Orb = Combo-Explosion |
| `3` | Rocket Launcher | tap: 1 Rocket; hold: bis 5 laden, Spread-Volley | Granaten/Cluster-Rockets oder geladene enge Spiral-Salve |
| `4` | Ripper | schnelle Disk, 3 Ricochets, ggf. Headshot-Bonus | explosive Disk, kein/kaum Bounce, explodiert bei Kontakt |
| `5` | Flak Cannon | Nahbereich-Shrapnel-Kegel | langsame Flak-Granate mit Splash bei Impact |
| `6` | Sniper Rifle | instant Präzisionsschuss, Headshot-Multiplikator | Zoom/Scope toggle oder hold-to-zoom |
| `7` | Gatling | kontrollierter Dauerfeuer-Modus, genauer | extrem hohe Kadenz, mehr Spread, mehr Recoil/Overheat |
| `8` | Pulse Lance | schnelle Plasma-Bolts | kurzer kontinuierlicher Beam/Stream mit Reichweitenlimit |
| `9` | Bio Lobber | kleine klebrige Bio-Klumpen, timed detonation | aufladen und großen Blob werfen; beim Impact splittet er |
| `0` | Redeemer Seed | langsame Mini-Nuke geradeaus | guided projectile / Kamera folgt Projektil, Spieler bleibt verwundbar |

**Stand 2026-05-23:** RMB = Alt-Fire pro Waffe; FP über **`V`** / **MMB** (`viewAimHeld`). Alle 10 Slots implementiert — Details `docs/weapons.md`, Plan `docs/umsetzung.md`.

Priorität für Implementation:
1. ~~Input-Modell erweitern~~ ✅
2. ~~`primary` / `secondary` Fire-Profile~~ ✅
3. ~~Einfache + komplexe RMBs (Pistol … Redeemer guided)~~ ✅
4. **`applyImpact`** — VFX/SFX → Rapier-Schaden, Build-HP, Bots (nächster Sprint).

Ja. Für Projectile-Impact würde ich pro Waffe eigene Trefferwirkung definieren, getrennt von LMB/RMB.

| Waffe | Impact-Vorschlag |
|---|---|
| Pistol | kleiner Funken/Hit-Spark, punktueller Schaden, kaum Impuls |
| Shock Blaster Beam | instant Energy-Splash am Trefferpunkt, kurzer Lichtblitz, hoher punktueller Schaden |
| Shock Orb | explodiert als Energie-Kugel; wenn vorher vom Beam getroffen: große Combo-Schockwelle |
| Rocket Launcher | starke Explosion mit Splash-Radius, Impuls auf Crates/Build-Pieces, sichtbarer Feuerball |
| Ripper LMB | prallt an Wänden ab; bei Gegner/Build-Piece schneidender Treffer, kleine Sparks, kein großer Splash |
| Ripper RMB | explodiert sofort bei Oberfläche/Ziel, kleiner bis mittlerer Splash |
| Flak LMB | viele einzelne Shrapnel-Impacts, jeder macht kleinen Schaden/Spark; sehr tödlich nah dran |
| Flak RMB | Granate explodiert und verteilt Sekundärsplitter oder macht großen Splitter-Splash |
| Sniper | winziger heller Einschlag, sehr hoher punktueller Schaden, Headshot-Sonderfall |
| Gatling | viele kleine Metall-/Energie-Hits, geringe Einzelwirkung, kurze Sparks, kleine Material-Chips |
| Pulse Lance Bolts | Plasma-Pop mit kleinem Radius, leichtem Push und grünem Lichtblitz |
| Pulse Stream | kontinuierliche Tick-Hits, kleine laufende Impact-Flashes statt einzelner Explosion |
| Bio Lobber LMB | klebt kurz an Oberfläche, verursacht Säure-Puddle/DOT oder explodiert verzögert |
| Bio Charged RMB | großer klebriger Blob, splittet in kleinere Puddles/Chunks beim Impact |
| Redeemer LMB | massive Explosion, großer Radius, starker Lichtblitz, Build-Piece-Zerstörung |
| Redeemer RMB | gleicher Nuke-Impact, aber nach guided flight; evtl. größerer Kamera-/Screen-Shake |

Für die Engine würde ich das als eigenes `ImpactProfile` pro Fire-Mode modellieren: `directDamage`, `splashRadius`, `splashDamage`, `impulse`, `ricochet`, `stickiness`, `childProjectiles`, `damageOverTime`, `effectKind`. Dann kann LMB/RMB nicht nur anders fliegen, sondern auch komplett anders einschlagen.