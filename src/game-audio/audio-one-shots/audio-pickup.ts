// Path: /Users/johann/MyBrew/funnel-real/src/game-audio/audio-one-shots/audio-pickup.ts

import { AUDIO_VOICE_PEAK } from '../audio-config';
import { AudioContextEngine } from '../audio-mixer';
import { spatialVectorFromPoint, type AudioPoint } from '../audio-system';
import { tryBeginSpatialOneShot } from '../audio-spatial-voice';
import { scheduleExponentialDecay } from './audio-one-shot-synth';
import type { PickupKind } from '../../arena/pickup-field';

const PICKUP_DURATION_S = 0.14;

const PICKUP_TONE_HZ: Record<PickupKind, number> = {
  health: 620,
  shield: 780
};


export function playPickupAt(origin: AudioPoint, kind: PickupKind): void {
  const voice = tryBeginSpatialOneShot(spatialVectorFromPoint(origin), 'generic');
  if (voice === null) {
    return;
  }

  AudioContextEngine.get().resume();
  const context = AudioContextEngine.get().context;
  const time = context.currentTime;
  const baseHz = PICKUP_TONE_HZ[kind];

  const masterGain = context.createGain();
  scheduleExponentialDecay(masterGain.gain, time, AUDIO_VOICE_PEAK * 0.72, PICKUP_DURATION_S);
  masterGain.connect(voice.input);

  const toneOsc = context.createOscillator();
  toneOsc.type = 'sine';
  toneOsc.frequency.setValueAtTime(baseHz, time);
  toneOsc.frequency.exponentialRampToValueAtTime(baseHz * 1.45, time + PICKUP_DURATION_S * 0.55);

  const toneGain = context.createGain();
  toneGain.gain.value = 0.58;
  toneOsc.connect(toneGain);
  toneGain.connect(masterGain);

  const sparkleOsc = context.createOscillator();
  sparkleOsc.type = 'triangle';
  sparkleOsc.frequency.setValueAtTime(baseHz * 2.1, time);
  sparkleOsc.frequency.exponentialRampToValueAtTime(baseHz * 2.8, time + PICKUP_DURATION_S * 0.4);

  const sparkleGain = context.createGain();
  sparkleGain.gain.value = 0.22;
  sparkleOsc.connect(sparkleGain);
  sparkleGain.connect(masterGain);

  toneOsc.start(time);
  sparkleOsc.start(time);
  toneOsc.stop(time + PICKUP_DURATION_S);
  sparkleOsc.stop(time + PICKUP_DURATION_S);

  voice.track(masterGain, toneOsc, toneGain, sparkleOsc, sparkleGain);
  voice.endAfter(toneOsc);
}

const REDEEMER_PICKUP_DURATION_S = 0.28;


export function playRedeemerPickupAt(origin: AudioPoint): void {
  const voice = tryBeginSpatialOneShot(spatialVectorFromPoint(origin), 'generic');
  if (voice === null) {
    return;
  }

  AudioContextEngine.get().resume();
  const context = AudioContextEngine.get().context;
  const time = context.currentTime;
  const baseHz = 280;

  const masterGain = context.createGain();
  scheduleExponentialDecay(masterGain.gain, time, AUDIO_VOICE_PEAK * 0.88, REDEEMER_PICKUP_DURATION_S);
  masterGain.connect(voice.input);

  const bodyOsc = context.createOscillator();
  bodyOsc.type = 'sawtooth';
  bodyOsc.frequency.setValueAtTime(baseHz, time);
  bodyOsc.frequency.exponentialRampToValueAtTime(920, time + REDEEMER_PICKUP_DURATION_S * 0.72);

  const bodyGain = context.createGain();
  bodyGain.gain.value = 0.42;
  bodyOsc.connect(bodyGain);
  bodyGain.connect(masterGain);

  const shineOsc = context.createOscillator();
  shineOsc.type = 'sine';
  shineOsc.frequency.setValueAtTime(640, time + 0.04);
  shineOsc.frequency.exponentialRampToValueAtTime(1480, time + REDEEMER_PICKUP_DURATION_S * 0.55);

  const shineGain = context.createGain();
  shineGain.gain.setValueAtTime(0, time);
  shineGain.gain.linearRampToValueAtTime(0.34, time + 0.05);
  shineGain.gain.exponentialRampToValueAtTime(0.001, time + REDEEMER_PICKUP_DURATION_S);
  shineOsc.connect(shineGain);
  shineGain.connect(masterGain);

  bodyOsc.start(time);
  shineOsc.start(time + 0.04);
  bodyOsc.stop(time + REDEEMER_PICKUP_DURATION_S);
  shineOsc.stop(time + REDEEMER_PICKUP_DURATION_S);

  voice.track(masterGain, bodyOsc, bodyGain, shineOsc, shineGain);
  voice.endAfter(bodyOsc);
}
