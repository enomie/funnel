# FUNNEL

Inspired by Unreal Tournament UT99 Funnel Mod, Star Wars & Tron, this is a high-speed WebGPU arena FPS shooter in a Fun Tunnel.

- **Spec:** [docs/introduction.md](docs/introduction.md)
- **Stack:** Three.js WebGPU + Rapier SIMD, Vite + TypeScript
- **Dev:** `npm install` → `npm run dev` → [http://localhost:3011/](http://localhost:3011/)
- **Origonal UT99 Funnel Video:** https://www.youtube.com/watch?v=KGDlYjuMloc
- https://www.youtube.com/@simondev758
- https://www.youtube.com/@robotbobby9
- https://www.reddit.com/r/threejs/

```bash
npm run lint
npm run build
```

## Technical Playthings

- **Procedural audio (synthesized & cached):** Weapon fire, impacts, fly-bys, footsteps, and UI cues are generated at runtime with the Web Audio API — oscillators, filtered noise, and envelope shaping. Reusable clips are baked offline into `AudioBuffer` objects and kept in shared in-memory caches so playback stays allocation-free during combat.
- **WebGPU & TSL:** Rendering runs on Three.js WebGPU with explicit GPU control. Shaders are authored in **Three.js Shading Language (TSL)** so lighting, weapon FX, and procedural tunnel geometry execute on the GPU and keep the main loop lean.
- **Rapier SIMD WASM:** Gameplay collisions run in `@dimforge/rapier3d-simd-compat` — SIMD-vectorized broad- and narrow-phase inside WASM, fixed substeps, and collider/raycast queries decoupled from mesh bounds so high-velocity hitscan and dense capsule traffic stay deterministic under load.
- **Pro roster bots:** The dev **15v15** roster spawns **14 allied + 15 enemy** bots from **two** Shooter-Pack rigs (your rig + alternate y/x-bot), with a **per-bot skeleton clone** and shared clip registries. They share Rapier capsules, render-frame locomotion (`tickHumanoidRenderFrame`), and weapon combat with the local player; bot brains run on a **lower tick rate** so full-roster stress stays representative without treating every bot as another human input loop.
- **Custom TTS & voice synthesis:** A built-in speech synthesizer (`GruntSynth`) turns text into audio via phonetic rules and per-character voice presets — jump/land grunts, UI hover lines, and match narration — with optional **3D spatial** playback through the same audio pipeline. Technically you can say anything.
- **Central frame clock:** Combat, bots, and projectiles share one rAF-driven `frameNowMs` from `GameFrameClock` in the main loop, with per-frame audio housekeeping and capped physics substeps plus backlog shedding so timing and DSP load stay aligned under stress.

MIT-License: see `LICENSE` and `package.json`.
