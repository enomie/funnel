// Path: /Users/johann/MyBrew/funnel-real/src/game-audio/audio-weapon/audio-weapon-reloading.ts

import type { Vector3 } from 'three/webgpu';
import { AUDIO_VOICE_PEAK } from '../audio-config';
import {
  isAudioAlive,
  registerAudioSilenceHook,
  safeConnect,
  safeCreateNode,
  safeDisconnect,
  safeStart,
  safeStop
} from '../audio-guard';
import { AudioContextEngine } from '../audio-mixer';
import { isWithinHearingRange } from '../audio-system';
import { setAudioParamImmediate } from '../audio-spatial-sync';
import { tryBeginSustainedSpatialVoice, type SustainedSpatialVoice } from '../audio-spatial-voice';

export type ReloadMechanicsKind = 'none' | 'chamber' | 'magazine';

export interface ReloadMechanicsState {
  readonly startedAtMs: number;
  readonly durationMs: number;
  readonly kind: ReloadMechanicsKind;
}

const RELOAD_TRI_BASE_HZ = 200;
const RELOAD_TRI_PEAK_HZ = 500;
const RELOAD_SQR_BASE_HZ = 300;
const RELOAD_SQR_PEAK_HZ = 600;
const RELOAD_IDLE_GAIN = AUDIO_VOICE_PEAK * 1.05;
const RELOAD_PEAK_GAIN = AUDIO_VOICE_PEAK * 1.55;
const RELOAD_ATTACK_S = 0.06;
/** Reach working loudness quickly — not tied to 30 s Redeemer reload length. */
const RELOAD_GAIN_RAMP_S = 0.22;
const RELOAD_RELEASE_S = 0.4;
/** Hard safety stop if sync/end path ever misses — prevents runaway osc / lease leak. */
const RELOAD_SAFETY_PADDING_S = 1.2;
/** Lease TTL beyond reload duration — supports 60 s+ reloads without early eviction. */
const RELOAD_TTL_PADDING_S = 2;

interface ReloadVoice {
  releaseLease: () => void;
  syncPosition: (position: Vector3) => void;
  triangleOsc: OscillatorNode;
  squareOsc: OscillatorNode;
  gain: GainNode;
  /** True once nodes are stopped, disconnected, and lease released. */
  finalized: boolean;
  /** Guards against overlapping fade/hard dispose on the same voice. */
  releasing: boolean;
}

export class WeaponReloadAudio {
  #trackedReloadStartMs = 0;
  #active: ReloadVoice | null = null;
  #fading: ReloadVoice | null = null;

  constructor() {
    registerAudioSilenceHook(() => {
      this.stop();
    });
  }

  stop(): void {
    this.#disposeVoice(this.#fading, 'hard');
    this.#disposeVoice(this.#active, 'hard');
    this.#trackedReloadStartMs = 0;
  }

  isActive(): boolean {
    return this.#active !== null || this.#fading !== null;
  }

  sync(position: Vector3, state: ReloadMechanicsState, nowMs: number): void {
    if (!isAudioAlive()) {
      this.stop();
      return;
    }

    const reloadActive =
      state.kind !== 'none' &&
      state.startedAtMs > 0 &&
      state.durationMs > 0 &&
      nowMs < state.startedAtMs + state.durationMs;

    if (reloadActive && state.startedAtMs !== this.#trackedReloadStartMs) {
      this.#disposeVoice(this.#fading, 'hard');
      this.#disposeVoice(this.#active, 'hard');
      this.#start(position, state.durationMs);
      this.#trackedReloadStartMs = state.startedAtMs;
    } else if (!reloadActive) {
      if (this.#active !== null || this.#trackedReloadStartMs > 0) {
        this.#disposeVoice(this.#active, 'fade');
        this.#trackedReloadStartMs = 0;
      }
      return;
    }

    const voice = this.#active;
    if (voice === null) {
      return;
    }

    const progress = Math.min(
      1,
      Math.max(0, (nowMs - state.startedAtMs) / state.durationMs)
    );
    voice.syncPosition(position);
    applyReloadTone(voice, progress);
  }

  #start(position: Vector3, durationMs: number): void {
    if (!isWithinHearingRange(position, 'near')) {
      return;
    }

    const durationS = durationMs / 1000;
    const ttlS = durationS + RELOAD_TTL_PADDING_S + RELOAD_RELEASE_S + RELOAD_SAFETY_PADDING_S;

    AudioContextEngine.get().resume();
    const sustained = tryBeginSustainedSpatialVoice(
      position,
      'mechanics-hold',
      'near',
      ttlS
    );
    if (sustained === null) {
      return;
    }

    const voice = wireReloadHoldGraph(sustained, durationS, (v) => {
      this.#finalizeVoice(v);
    });
    if (voice === null) {
      sustained.release();
      return;
    }

    sustained.onAutoRelease(() => {
      this.#detachVoice(voice);
    });

    this.#active = voice;
  }

  #detachVoice(voice: ReloadVoice): void {
    if (this.#active === voice) {
      this.#active = null;
    }
    if (this.#fading === voice) {
      this.#fading = null;
    }
    if (this.#active === null && this.#fading === null) {
      this.#trackedReloadStartMs = 0;
    }
  }

  #disposeVoice(voice: ReloadVoice | null, mode: 'fade' | 'hard'): void {
    if (voice === null || voice.finalized || voice.releasing) {
      return;
    }

    voice.releasing = true;
    voice.triangleOsc.onended = null;
    voice.squareOsc.onended = null;

    if (this.#active === voice) {
      this.#active = null;
    }
    if (this.#fading === voice) {
      this.#fading = null;
    }

    const context = AudioContextEngine.get().context;
    const now = context.currentTime;

    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(0.001, now);

    if (mode === 'hard') {
      this.#finalizeVoice(voice);
      return;
    }

    this.#fading = voice;
    voice.gain.gain.exponentialRampToValueAtTime(0.001, now + RELOAD_RELEASE_S);

    const fadeEnd = now + RELOAD_RELEASE_S;
    const stopTime = fadeEnd + 0.02;
    safeStop(voice.triangleOsc, stopTime, 'reload-tri-fade-stop');
    safeStop(voice.squareOsc, stopTime, 'reload-sqr-fade-stop');

    voice.squareOsc.onended = () => {
      this.#finalizeVoice(voice);
    };
  }

  #finalizeVoice(voice: ReloadVoice): void {
    if (voice.finalized) {
      return;
    }

    voice.finalized = true;
    voice.releasing = true;
    voice.triangleOsc.onended = null;
    voice.squareOsc.onended = null;

    const stopTime = AudioContextEngine.get().context.currentTime;
    voice.gain.gain.cancelScheduledValues(0);
    setAudioParamImmediate(voice.gain.gain, 0.001);
    safeStop(voice.triangleOsc, stopTime, 'reload-tri-final-stop');
    safeStop(voice.squareOsc, stopTime, 'reload-sqr-final-stop');
    safeDisconnect(voice.gain, 'reload-gain-final-disconnect');
    safeDisconnect(voice.triangleOsc, 'reload-tri-final-disconnect');
    safeDisconnect(voice.squareOsc, 'reload-sqr-final-disconnect');
    voice.releaseLease();

    if (this.#active === voice) {
      this.#active = null;
    }
    if (this.#fading === voice) {
      this.#fading = null;
    }
    if (this.#active === null && this.#fading === null) {
      this.#trackedReloadStartMs = 0;
    }
  }
}

function wireReloadHoldGraph(
  sustained: SustainedSpatialVoice,
  durationS: number,
  onFinalized: (voice: ReloadVoice) => void
): ReloadVoice | null {
  const context = AudioContextEngine.get().context;
  const time = context.currentTime;
  const safetyStopTime = time + durationS + RELOAD_RELEASE_S + RELOAD_SAFETY_PADDING_S;

  const gain = safeCreateNode('reload-gain', () => context.createGain());
  const triangleOsc = safeCreateNode('reload-tri-osc', () => context.createOscillator());
  const squareOsc = safeCreateNode('reload-sqr-osc', () => context.createOscillator());
  if (gain === null || triangleOsc === null || squareOsc === null) {
    return null;
  }

  gain.gain.setValueAtTime(0.001, time);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, RELOAD_IDLE_GAIN), time + RELOAD_ATTACK_S);
  const gainPeakAt =
    time +
    RELOAD_ATTACK_S +
    Math.min(Math.max(0, durationS - RELOAD_ATTACK_S), RELOAD_GAIN_RAMP_S);
  gain.gain.linearRampToValueAtTime(RELOAD_PEAK_GAIN, gainPeakAt);

  triangleOsc.type = 'triangle';
  triangleOsc.frequency.setValueAtTime(RELOAD_TRI_BASE_HZ, time);
  triangleOsc.frequency.linearRampToValueAtTime(RELOAD_TRI_PEAK_HZ, time + durationS);

  squareOsc.type = 'square';
  squareOsc.frequency.setValueAtTime(RELOAD_SQR_BASE_HZ, time);
  squareOsc.frequency.linearRampToValueAtTime(RELOAD_SQR_PEAK_HZ, time + durationS);

  if (
    !safeConnect(triangleOsc, gain, 'reload-tri-gain') ||
    !safeConnect(squareOsc, gain, 'reload-sqr-gain') ||
    !safeConnect(gain, sustained.input, 'reload-input')
  ) {
    return null;
  }

  if (
    !safeStart(triangleOsc, time, 'reload-tri-start') ||
    !safeStart(squareOsc, time, 'reload-sqr-start')
  ) {
    safeStop(triangleOsc, time + 0.01, 'reload-tri-rollback');
    safeStop(squareOsc, time + 0.01, 'reload-sqr-rollback');
    return null;
  }

  safeStop(triangleOsc, safetyStopTime, 'reload-tri-safety-stop');
  safeStop(squareOsc, safetyStopTime, 'reload-sqr-safety-stop');
  sustained.track(gain, triangleOsc, squareOsc);

  const voice: ReloadVoice = {
    releaseLease: () => {
      sustained.release();
    },
    syncPosition: (position) => {
      sustained.syncPosition(position);
    },
    triangleOsc,
    squareOsc,
    gain,
    finalized: false,
    releasing: false
  };

  squareOsc.onended = () => {
    onFinalized(voice);
  };

  return voice;
}

function applyReloadTone(_voice: ReloadVoice, _progress: number): void {
  // Tone envelope is scheduled once at voice start — per-frame param writes caused crackle.
}
