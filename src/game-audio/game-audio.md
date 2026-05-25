# Game Audio

**Single source of truth** — prozedurales Spatial-Audio unter `src/game-audio/`.

---

## Architektur

```
sources → voice.input → PannerNode (gepoolt) → sfx bus → master (0.92) → destination
```

| Modul | Aufgabe |
|-------|---------|
| `audio-config.ts` | Caps, Gain, Hörweiten, Panner, Lease-TTL/Evict-Rank |
| `audio-mixer.ts` | Singleton `AudioContext`, master + sfx |
| `audio-system.ts` | Listener-Sync, Hearing-Range, `AudioPoint` |
| `audio-spatial-voice.ts` | **Spatial-Lease-Pool** — One-Shot + Sustained Hold |
| `audio-spatial-sync.ts` | `setAudioParamImmediate`, Panner-Position (kein per-Frame-Scheduling) |
| `audio-noise-buffer.ts` | Gebackene Noise-Clips (shared cache) |
| `audio-manager.ts` | App-Einstieg — resume, sync, `WeaponAudio`, `tickGameAudio` |
| `audio-one-shots/` | Impact, Footstep, Pickup, Synth-Helpers |
| `audio-flyby/` | Projektil-Flug-Loops (eigener Slot-Pool) |
| `audio-weapon/` | `WeaponAudio`, Fire, Reload, Bio/Beam Hold |
| `audio-grunts/` | Jump/Land-Grunts (spatial TTS) |
| `core/frame-housekeeping.ts` | Zentral: Audio-Sweep + Segment-TTL + World-Effects |

Kein `src/audio/`. Kein direkter `panner.connect(sfxInput)` in Combat/Mechanics-Holds.

### Spatial-Lease-Regeln (Pflicht)

1. **Kurz (< 3 s):** `tryBeginSpatialOneShot(position, kind)` → Synth nodes an `voice.input` → `voice.track(...)` → `voice.endAfter(anchor)`.
2. **Hold (RMB Bio/Beam, Reload, lange Blasts):** `tryBeginSustainedSpatialVoice(position, kind, range, ttlOverrideS?)` → Graph an `voice.input` → `voice.track(...)` → manuell `release()` oder Lease-Sweep.
3. **Updates im Hold:** nur `setAudioParamImmediate` + `syncPosition` — **kein** `setTargetAtTime` / `setValueAtTime` pro Render-Frame.
4. **Release:** `releaseSpatialOneShotHandle(handle)` oder `sustained.release()` — nie Nodes am Bus hängen lassen.
5. **Sweep:** `sweepExpiredSpatialOneShots()` jeden Frame in `tickGameAudio`.

### Lease-Kinds

| Kind | TTL | Cap | Verwendung |
|------|-----|-----|------------|
| `fire` | 0.55 s | 48 (global) | Waffen-Feuer |
| `impact` | 2 s | 48 | Treffer-One-Shots |
| `redeemer-blast` | 3.2 s | 3 | Expanding-Lethal-Detonation |
| `mechanics-hold` | 45 s (Safety) | 3 | Bio-RMB, Pulse-Beam, Reload |
| `mechanics` | 0.08 s | 48 | Rocket-Mark-Clicks, Dry-Fire |
| `foot` / `grunt` | 0.2 / 4 s | 6 / 48 | Schritte, Sprach-Grunts |

Eviction-Rank: niedrigere Werte werden zuerst verdrängt (`mechanics-hold` = 7, schwer zu evicten).

### App-Anbindung

`funnel-app.ts` → `frame-housekeeping.ts` + `audio-manager.ts`:

- `tickFrameHousekeeping(...)` — Audio-Sweep, Segment-Lines, World-Effects (Lifecycle nie load-shedden)
- `resumeGameAudio()` / `bindGameAudioUserGestureResume()` — Context nach User-Gesture
- `syncAudioListenerFromCamera()` — einmal pro Render-Frame
- `createWeaponAudio()` — shared Combat-Bridge (Player + Bots + ProjectileSim)

### Refresh-Rate / Interpolation

- Listener folgt interpolierter Kamera.
- Footsteps auf interpolierter Spielerposition.
- Flyby: Graph pro Slot, zerstört bei Detach; `cleanupFlybyVoices()` pro Frame.
- Laufende Params nur via `.value` (`setAudioParamImmediate`).
- One-Shots an `AudioContext.currentTime` — unabhängig von Render-Hz.

---

## Voice pools

| Pool | Cap | Konstante | Anmerkung |
|------|-----|-----------|-----------|
| Spatial one-shots | 48 | `SPATIAL_ONE_SHOT_VOICE_CAP` | Panner+Input gepoolt |
| Fly loops | 24 | `WEAPON_AUDIO_FLY_VOICE_CAP` | Eigener Pool, nicht Spatial-Lease |
| Footsteps | 6 | `FOOTSTEP_VOICE_CAP` | Sub-Cap innerhalb Spatial |
| Redeemer blast | 3 | (in `audio-spatial-voice`) | Sub-Cap |
| Mechanics hold | 3 | (in `audio-spatial-voice`) | Bio + Beam + Reload |

Hörweite: **150 m** (fire, fly, impact) · **320 m** (`redeemer-blast`, mapWide) · **20 m** (foot, grunt, mechanics, mechanics-hold).

---

## Ausnahmen (bewusst non-lease)

| Pfad | Grund |
|------|-------|
| `audio-hit-confirm.ts` | UI-Feedback, < 100 ms, non-spatial, self-stop |
| `audio-flyby/` | Doppler-Loop braucht eigenen Slot-Graph; eigener Cleanup-Pfad |

Neue Features: **nicht** ohne Review in diese Ausnahmen — Default ist Spatial-Lease.

---

## Requirements (Kurz)

1. Spawn / Fly / Impact über `WeaponAudio` + Flyby-Pool
2. RMB-Holds + Reload über `mechanics-hold` sustained lease
3. Redeemer-Detonation über `redeemer-blast` lease (nicht separater Graph-Factory)
4. Peak `AUDIO_VOICE_PEAK` (0.035); Combat-Modifier via `IMPACT_GAIN_*`
5. `[audio:KILLED]` = permanenter Context-Ausfall — sofort Stress-Test abbrechen und Lease-Leak prüfen
