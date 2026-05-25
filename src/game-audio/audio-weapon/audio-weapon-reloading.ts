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

const RELOAD_SAW_BASE_HZ = 280;
const RELOAD_SAW_PEAK_HZ = 640;
const RELOAD_IDLE_GAIN = AUDIO_VOICE_PEAK * 0.14;
const RELOAD_PEAK_GAIN = AUDIO_VOICE_PEAK * 0.26;
const RELOAD_ATTACK_S = 0.1;
const RELOAD_RELEASE_S = 0.4;
/** Hard safety stop if sync/end path ever misses — prevents runaway osc / lease leak. */
const RELOAD_SAFETY_PADDING_S = 1.2;
/** Lease TTL beyond reload duration — supports 60 s+ reloads without early eviction. */
const RELOAD_TTL_PADDING_S = 2;

interface ReloadVoice {
  releaseLease: () => void;
  syncPosition: (position: Vector3) => void;
  osc: OscillatorNode;
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
    voice.osc.onended = null;

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
    safeStop(voice.osc, fadeEnd + 0.02, 'reload-saw-fade-stop');

    voice.osc.onended = () => {
      this.#finalizeVoice(voice);
    };
  }

  #finalizeVoice(voice: ReloadVoice): void {
    if (voice.finalized) {
      return;
    }

    voice.finalized = true;
    voice.releasing = true;
    voice.osc.onended = null;

    voice.gain.gain.cancelScheduledValues(0);
    setAudioParamImmediate(voice.gain.gain, 0.001);
    safeStop(voice.osc, AudioContextEngine.get().context.currentTime, 'reload-saw-final-stop');
    safeDisconnect(voice.gain, 'reload-gain-final-disconnect');
    safeDisconnect(voice.osc, 'reload-osc-final-disconnect');
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

  const gain = safeCreateNode('reload-saw-gain', () => context.createGain());
  const osc = safeCreateNode('reload-saw-osc', () => context.createOscillator());
  if (gain === null || osc === null) {
    return null;
  }

  gain.gain.setValueAtTime(0.001, time);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, RELOAD_IDLE_GAIN), time + RELOAD_ATTACK_S);

  osc.type = 'sawtooth';
  setAudioParamImmediate(osc.frequency, RELOAD_SAW_BASE_HZ);

  if (
    !safeConnect(osc, gain, 'reload-saw-gain') ||
    !safeConnect(gain, sustained.input, 'reload-saw-input')
  ) {
    return null;
  }

  if (!safeStart(osc, time, 'reload-saw-start')) {
    safeStop(osc, time + 0.01, 'reload-saw-rollback');
    return null;
  }

  safeStop(osc, safetyStopTime, 'reload-saw-safety-stop');
  sustained.track(gain, osc);

  const voice: ReloadVoice = {
    releaseLease: () => {
      sustained.release();
    },
    syncPosition: (position) => {
      sustained.syncPosition(position);
    },
    osc,
    gain,
    finalized: false,
    releasing: false
  };

  osc.onended = () => {
    onFinalized(voice);
  };

  return voice;
}

function applyReloadTone(voice: ReloadVoice, progress: number): void {
  const t = Math.max(0, Math.min(1, progress));
  const hz = RELOAD_SAW_BASE_HZ + t * (RELOAD_SAW_PEAK_HZ - RELOAD_SAW_BASE_HZ);
  const level = RELOAD_IDLE_GAIN + t * (RELOAD_PEAK_GAIN - RELOAD_IDLE_GAIN);

  setAudioParamImmediate(voice.osc.frequency, hz);
  setAudioParamImmediate(voice.gain.gain, level);
}
