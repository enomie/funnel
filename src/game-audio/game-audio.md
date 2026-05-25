# Game Audio

**Single source of truth** — schlankes, prozedurales Spatial-Audio unter `src/game-audio/`.

---

## Architektur

```
sources → voice.input → PannerNode → sfx bus → master (0.92) → destination
```

| Modul | Aufgabe |
|-------|---------|
| `audio-config.ts` | Caps, Gain, Hörweiten, Panner |
| `audio-mixer.ts` | Singleton `AudioContext`, master + sfx |
| `audio-system.ts` | Listener-Sync, Hearing-Range, `AudioPoint` |
| `audio-spatial-voice.ts` | One-shot Voice-Pool (fire, impact, foot, grunt, mechanics) |
| `audio-noise-buffer.ts` | Gebackene Noise-Clips (shared cache) |
| `audio-manager.ts` | **App-Einstieg** — resume, sync, `WeaponAudio` |
| `audio-one-shots/` | Impact, Footstep, Pickup, Synth-Helpers |
| `audio-flyby/` | Projektil-Flug-Loops (attach → sync → detach) |
| `audio-weapon/` | `WeaponAudio`, Fire-Preset, Reload, Dry-Fire |
| `audio-grunts/` | Jump/Land-Grunts (spatial TTS) |

Kein `src/audio/`. Kein Weapon-Sprite-Bake. Kein Footstep-Submix-Compressor.

### App-Anbindung

`funnel-app.ts` → nur `audio-manager.ts`:

- `resumeGameAudio()` — Context nach User-Gesture
- `warmGameAudio()` — Context resume (kein Asset-Bake)
- `syncAudioListenerFromCamera()` — einmal pro Frame
- `createWeaponAudio()` — Combat-Bridge

Combat/Bots importieren `WeaponAudio` aus `audio-weapon/audio-weapon.ts`.

---

## Requirements

### Projectiles

1. **Spawn-Geräusch** — `WeaponAudio.playFire()` am Muzzle
2. **Fluggeräusch** — jedes World-Projektil: Hum + Noise-Loop via `audio-flyby/`
3. **Impact** — `WeaponAudio.playImpact()` am Trefferpunkt
4. **Massenstress** — Fly-Loops nicht weglassen; Gain/Caps begrenzen
5. **Ripper Ricochet** — leiserer Impact (`IMPACT_GAIN_RICOCHET`)

### Footsteps

6. **Footsteps + Grunts + Reload + RMB-Hold 20 m, alles andere 150 m** — `kind: 'foot'` / `'grunt'` / `'mechanics'` → 20 m
7. **SFX-Maßstab** — `FOOTSTEP_STEP_VOLUME` / `FOOTSTEP_LAND_VOLUME` ≈ Impact (~0.03)

### Gain

8. **Gleiche Lautstärke** — jede Voice peakt bei `AUDIO_VOICE_PEAK` (0.035); Overlap fängt **ein** SFX-Bus-Limiter in `audio-mixer.ts`
9. **Combat-Modifier** — `IMPACT_GAIN_*` multipliziert nur den Peak

---

## Voice pools

| Pool | Cap | Konstante |
|------|-----|-----------|
| One-shots | 32 | `SPATIAL_ONE_SHOT_VOICE_CAP` |
| Fly loops | 12 | `WEAPON_AUDIO_FLY_VOICE_CAP` |
| Footsteps | 6 | `FOOTSTEP_VOICE_CAP` |

Hörweite: **150 m** (fire, fly, impact) · **20 m** (footsteps, grunts, landings, reload, RMB charge/mark am Muzzle).
