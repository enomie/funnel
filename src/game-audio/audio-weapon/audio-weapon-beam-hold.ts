// Path: /Users/johann/MyBrew/funnel-real/src/game-audio/audio-weapon/audio-weapon-beam-hold.ts

import type { Vector3 } from 'three/webgpu';
import { getNoiseBuffer } from '../audio-noise-buffer';
import { AUDIO_VOICE_PEAK } from '../audio-config';
import {
  isAudioAlive,
  registerAudioSilenceHook,
  safeConnect,
  safeCreateNode,
  safeStart,
  safeStop
} from '../audio-guard';
import { AudioContextEngine } from '../audio-mixer';
import { isWithinHearingRange } from '../audio-system';
import { setAudioParamImmediate } from '../audio-spatial-sync';
import { tryBeginSustainedSpatialVoice, type SustainedSpatialVoice } from '../audio-spatial-voice';

export interface BeamHoldMechanicsState {
  readonly active: boolean;
  readonly heatFraction: number;
}

const PULSE_BEAM_BASE_HZ = 168;
const PULSE_BEAM_PEAK_HZ = 248;
const PULSE_BEAM_HARMONIC_RATIO = 2.65;
const PULSE_BEAM_BASE_GAIN = AUDIO_VOICE_PEAK * 0.34;
const PULSE_BEAM_PEAK_GAIN = AUDIO_VOICE_PEAK * 0.62;
const PULSE_BEAM_NOISE_FILTER_HZ = 920;
const PULSE_BEAM_NOISE_GAIN = 0.38;

interface PulseBeamHoldVoice {
  release: () => void;
  syncPosition: (position: Vector3) => void;
  mixGain: GainNode;
  coreOsc: OscillatorNode;
  harmonicOsc: OscillatorNode;
  noiseFilter: BiquadFilterNode;
}


export class WeaponBeamHoldAudio {
  #hold: PulseBeamHoldVoice | null = null;

  constructor() {
    registerAudioSilenceHook(() => {
      this.stop();
    });
  }

  sync(position: Vector3, state: BeamHoldMechanicsState): void {
    if (!isAudioAlive()) {
      this.stop();
      return;
    }

    if (!state.active) {
      this.stop();
      return;
    }

    if (this.#hold === null) {
      this.#start(position, state.heatFraction);
      return;
    }

    this.#update(position, state.heatFraction);
  }

  stop(): void {
    const hold = this.#hold;
    if (hold === null) {
      return;
    }

    hold.release();
    this.#hold = null;
  }

  isActive(): boolean {
    return this.#hold !== null;
  }

  #start(position: Vector3, heatFraction: number): void {
    if (!isWithinHearingRange(position, 'near')) {
      return;
    }

    AudioContextEngine.get().resume();
    const sustained = tryBeginSustainedSpatialVoice(position, 'mechanics-hold', 'near');
    if (sustained === null) {
      return;
    }

    const hold = wirePulseBeamHoldGraph(sustained, heatFraction);
    if (hold === null) {
      sustained.release();
      return;
    }

    sustained.onAutoRelease(() => {
      this.#hold = null;
    });

    this.#hold = hold;
  }

  #update(position: Vector3, heatFraction: number): void {
    const hold = this.#hold;
    if (hold === null) {
      return;
    }

    const hz = beamHzForHeat(heatFraction);
    const gain = beamGainForHeat(heatFraction);
    hold.syncPosition(position);
    setAudioParamImmediate(hold.mixGain.gain, gain);
    setAudioParamImmediate(hold.coreOsc.frequency, hz);
    setAudioParamImmediate(hold.harmonicOsc.frequency, hz * PULSE_BEAM_HARMONIC_RATIO);
    setAudioParamImmediate(
      hold.noiseFilter.frequency,
      PULSE_BEAM_NOISE_FILTER_HZ + heatFraction * 280
    );
  }
}

function wirePulseBeamHoldGraph(
  sustained: SustainedSpatialVoice,
  heatFraction: number
): PulseBeamHoldVoice | null {
  const context = AudioContextEngine.get().context;
  const time = context.currentTime;
  const gain = beamGainForHeat(heatFraction);
  const hz = beamHzForHeat(heatFraction);

  const mixGain = safeCreateNode('pulse-beam-mix-gain', () => context.createGain());
  if (mixGain === null) {
    return null;
  }

  setAudioParamImmediate(mixGain.gain, gain);
  if (!safeConnect(mixGain, sustained.input, 'pulse-beam-mix-input')) {
    return null;
  }

  const coreGain = safeCreateNode('pulse-beam-core-gain', () => context.createGain());
  const harmonicGain = safeCreateNode('pulse-beam-harmonic-gain', () => context.createGain());
  const coreOsc = safeCreateNode('pulse-beam-core-osc', () => context.createOscillator());
  const harmonicOsc = safeCreateNode('pulse-beam-harmonic-osc', () => context.createOscillator());
  if (coreGain === null || harmonicGain === null || coreOsc === null || harmonicOsc === null) {
    return null;
  }

  coreGain.gain.value = 0.72;
  harmonicGain.gain.value = 0.42;
  coreOsc.type = 'sawtooth';
  harmonicOsc.type = 'square';
  setAudioParamImmediate(coreOsc.frequency, hz);
  setAudioParamImmediate(harmonicOsc.frequency, hz * PULSE_BEAM_HARMONIC_RATIO);

  if (
    !safeConnect(coreOsc, coreGain, 'pulse-beam-core-gain') ||
    !safeConnect(harmonicOsc, harmonicGain, 'pulse-beam-harmonic-gain') ||
    !safeConnect(coreGain, mixGain, 'pulse-beam-core-mix') ||
    !safeConnect(harmonicGain, mixGain, 'pulse-beam-harmonic-mix')
  ) {
    return null;
  }

  const noiseSource = safeCreateNode('pulse-beam-noise', () => context.createBufferSource());
  const noiseFilter = safeCreateNode('pulse-beam-noise-filter', () => context.createBiquadFilter());
  const noiseGain = safeCreateNode('pulse-beam-noise-gain', () => context.createGain());
  if (noiseSource === null || noiseFilter === null || noiseGain === null) {
    return null;
  }

  noiseSource.buffer = getNoiseBuffer(context, 'bio-rumble');
  noiseSource.loop = true;
  noiseFilter.type = 'bandpass';
  setAudioParamImmediate(noiseFilter.frequency, PULSE_BEAM_NOISE_FILTER_HZ + heatFraction * 280);
  noiseFilter.Q.value = 1.1;
  noiseGain.gain.value = PULSE_BEAM_NOISE_GAIN;

  if (
    !safeConnect(noiseSource, noiseFilter, 'pulse-beam-noise-filter') ||
    !safeConnect(noiseFilter, noiseGain, 'pulse-beam-filter-gain') ||
    !safeConnect(noiseGain, mixGain, 'pulse-beam-noise-mix')
  ) {
    return null;
  }

  if (
    !safeStart(coreOsc, time, 'pulse-beam-core-start') ||
    !safeStart(harmonicOsc, time, 'pulse-beam-harmonic-start') ||
    !safeStart(noiseSource, time, 'pulse-beam-noise-start')
  ) {
    safeStop(coreOsc, time + 0.01, 'pulse-beam-core-rollback');
    safeStop(harmonicOsc, time + 0.01, 'pulse-beam-harmonic-rollback');
    safeStop(noiseSource, time + 0.01, 'pulse-beam-noise-rollback');
    return null;
  }

  sustained.track(
    mixGain,
    coreOsc,
    coreGain,
    harmonicOsc,
    harmonicGain,
    noiseSource,
    noiseFilter,
    noiseGain
  );

  return {
    release: () => {
      sustained.release();
    },
    syncPosition: (position) => {
      sustained.syncPosition(position);
    },
    mixGain,
    coreOsc,
    harmonicOsc,
    noiseFilter
  };
}

function beamHzForHeat(heatFraction: number): number {
  const heat = Math.max(0, Math.min(1, heatFraction));
  return PULSE_BEAM_BASE_HZ + heat * (PULSE_BEAM_PEAK_HZ - PULSE_BEAM_BASE_HZ);
}

function beamGainForHeat(heatFraction: number): number {
  const heat = Math.max(0, Math.min(1, heatFraction));
  return PULSE_BEAM_BASE_GAIN + heat * (PULSE_BEAM_PEAK_GAIN - PULSE_BEAM_BASE_GAIN);
}
