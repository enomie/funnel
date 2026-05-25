# FUNNEL

Inspired by Unreal Tournament UT99 Funnel Mod, Star Wars & Tron, this is a high-speed WebGPU arena FPS shooter in a Fun Tunnel.

- **Spec:** [docs/introduction.md](docs/introduction.md)
- **Stack:** Three.js WebGPU + Rapier SIMD, Vite + TypeScript
- **Dev:** `npm install` → `npm run dev` → [http://localhost:3011/](http://localhost:3011/)
- **Origonal UT99 Funnel Video:** https://www.youtube.com/watch?v=KGDlYjuMloc

```bash
npm run lint
npm run build
```

## Technical Playthings

- **Procedural audio (synthesized & cached):** Weapon fire, impacts, fly-bys, footsteps, and UI cues are generated at runtime with the Web Audio API — oscillators, filtered noise, and envelope shaping — not loaded from sample banks. Reusable clips are baked offline into `AudioBuffer` objects and kept in shared in-memory caches so playback stays allocation-free during combat.
- **WebGPU & TSL:** Rendering runs on Three.js WebGPU with explicit GPU control. Shaders are authored in **Three.js Shading Language (TSL)** so lighting, weapon FX, and procedural tunnel geometry execute on the GPU and keep the main loop lean.
- **Custom TTS & voice synthesis:** A built-in speech synthesizer (`GruntSynth`) turns text into audio via phonetic rules and per-character voice presets — jump/land grunts, UI hover lines, and match narration — with optional **3D spatial** playback through the same audio pipeline. Technically you can say anything.
- **Central frame clock:** Combat, bots, and projectiles share one rAF `frameNowMs` from the main loop (no scattered `performance.now()`), with per-frame audio housekeeping and physics backlog shedding so timing and DSP load stay aligned under stress.

MIT-License: see `LICENSE` and `package.json`.
