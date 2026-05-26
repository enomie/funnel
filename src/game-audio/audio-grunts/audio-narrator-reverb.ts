// Path: /Users/johann/MyBrew/funnel-real/src/game-audio/audio-grunts/audio-narrator-reverb.ts

import {
  isAudioAlive,
  registerAudioSilenceHook,
  safeConnect,
  safeCreateNode
} from '../audio-guard';
import { AudioContextEngine } from '../audio-mixer';
import { AUDIO_COUNTDOWN_NARRATOR_GAIN } from '../audio-config';

const NARRATOR_REVERB_DRY = 0.58;
const NARRATOR_REVERB_WET = 0.4;
const NARRATOR_REVERB_IR_DURATION_S = 2.4;
const NARRATOR_REVERB_IR_DECAY = 3.2;
const NARRATOR_REVERB_WET_CUTOFF_HZ = 3200;

let narratorInput: GainNode | null = null;
let narratorReverbReady = false;
let narratorReverbFailed = false;
let silenceHookRegistered = false;

function createHallImpulseResponse(context: BaseAudioContext): AudioBuffer {
  const frameCount = Math.ceil(context.sampleRate * NARRATOR_REVERB_IR_DURATION_S);
  const buffer = context.createBuffer(2, frameCount, context.sampleRate);

  for (let channel = 0; channel < 2; channel += 1) {
    const samples = buffer.getChannelData(channel);
    const stereoSpread = channel === 0 ? 1 : 0.92;

    for (let index = 0; index < frameCount; index += 1) {
      const progress = index / frameCount;
      const envelope = Math.pow(1 - progress, NARRATOR_REVERB_IR_DECAY) * stereoSpread;
      samples[index] = (Math.random() * 2 - 1) * envelope;
    }
  }

  return buffer;
}

function silenceNarratorReverb(): void {
  if (narratorInput === null) {
    return;
  }

  try {
    narratorInput.gain.value = 0;
  } catch {
    // Input may already be torn down.
  }
}

function ensureNarratorReverbBus(): boolean {
  if (narratorReverbFailed) {
    return false;
  }

  if (narratorReverbReady && narratorInput !== null) {
    return true;
  }

  if (!isAudioAlive()) {
    return false;
  }

  const engine = AudioContextEngine.get();
  const context = engine.context;
  const sfxInput = engine.sfxInput;

  const input = safeCreateNode('narrator-reverb-input', () => context.createGain());
  const dryGain = safeCreateNode('narrator-reverb-dry', () => context.createGain());
  const wetGain = safeCreateNode('narrator-reverb-wet', () => context.createGain());
  const convolver = safeCreateNode('narrator-reverb-convolver', () => context.createConvolver());
  const wetFilter = safeCreateNode('narrator-reverb-wet-filter', () => context.createBiquadFilter());

  if (input === null || dryGain === null || wetGain === null || convolver === null || wetFilter === null) {
    narratorReverbFailed = true;
    return false;
  }

  try {
    convolver.buffer = createHallImpulseResponse(context);
    convolver.normalize = true;
  } catch {
    narratorReverbFailed = true;
    return false;
  }

  input.gain.value = AUDIO_COUNTDOWN_NARRATOR_GAIN;
  dryGain.gain.value = NARRATOR_REVERB_DRY;
  wetGain.gain.value = NARRATOR_REVERB_WET;
  wetFilter.type = 'lowpass';
  wetFilter.frequency.value = NARRATOR_REVERB_WET_CUTOFF_HZ;
  wetFilter.Q.value = 0.62;

  if (
    !safeConnect(input, dryGain, 'narrator-reverb-input-dry') ||
    !safeConnect(dryGain, sfxInput, 'narrator-reverb-dry-bus') ||
    !safeConnect(input, convolver, 'narrator-reverb-input-convolver') ||
    !safeConnect(convolver, wetFilter, 'narrator-reverb-convolver-filter') ||
    !safeConnect(wetFilter, wetGain, 'narrator-reverb-filter-wet') ||
    !safeConnect(wetGain, sfxInput, 'narrator-reverb-wet-bus')
  ) {
    narratorReverbFailed = true;
    narratorInput = null;
    narratorReverbReady = false;
    return false;
  }

  narratorInput = input;
  narratorReverbReady = true;

  if (!silenceHookRegistered) {
    silenceHookRegistered = true;
    registerAudioSilenceHook(silenceNarratorReverb);
  }

  return true;
}

/** Countdown narrator destination — hall send with dry fallback to sfx bus. */
export function getNarratorCountdownDestination(): AudioNode {
  if (ensureNarratorReverbBus() && narratorInput !== null) {
    return narratorInput;
  }

  return AudioContextEngine.get().sfxInput;
}
