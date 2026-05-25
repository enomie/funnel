import type { Vector3 } from 'three/webgpu';
import { tryBeginSpatialOneShot } from '../audio-spatial-voice';
import { AudioContextEngine } from '../audio-mixer';
import { playBakedPhrase, scheduleVoiceTail } from '../audio-baked-phrase';
import { getBakedNoAmmoClick } from './audio-weapon-bake';
import {
  NO_AMMO_PHRASE_DURATION_S,
  scheduleNoAmmoPhrase
} from '../audio-one-shots/audio-no-ammo-phrase';

const NO_AMMO_KLICK_MIN_INTERVAL_MS = 180;

let lastKlickAtMs = 0;

/** Dry trigger snap — one sound for every weapon when firing with no ammo. */
export function playNoAmmoKlick(position: Vector3, nowMs: number): void {
  if (nowMs < lastKlickAtMs + NO_AMMO_KLICK_MIN_INTERVAL_MS) {
    return;
  }

  lastKlickAtMs = nowMs;
  const voice = tryBeginSpatialOneShot(position, 'mechanics');
  if (voice === null) {
    return;
  }

  AudioContextEngine.get().resume();
  const context = AudioContextEngine.get().context;
  const baked = getBakedNoAmmoClick();
  if (baked !== undefined) {
    const played = playBakedPhrase(context, baked, voice.input);
    voice.track(played.source, played.gainNode);
    voice.endAfter(played.source);
    return;
  }

  scheduleNoAmmoPhrase(context, voice.input, context.currentTime);
  const tail = scheduleVoiceTail(context, voice.input, NO_AMMO_PHRASE_DURATION_S);
  voice.track(tail);
  voice.endAfter(tail);
}
