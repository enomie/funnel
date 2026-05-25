// Path: /Users/johann/MyBrew/funnel-real/src/game-audio/audio-one-shots/audio-hit-confirm.ts

import { AUDIO_VOICE_PEAK } from '../audio-config';
import { AudioContextEngine } from '../audio-mixer';
import { getNoiseBuffer } from '../audio-noise-buffer';
import { scheduleExponentialDecay } from './audio-one-shot-synth';


export const HIT_CONFIRM_DURATION_S = 0.036;
export const KILL_CONFIRM_DURATION_S = 0.082;

const HIT_CONFIRM_GAIN = AUDIO_VOICE_PEAK * 1.35;
const KILL_CONFIRM_GAIN = AUDIO_VOICE_PEAK * 1.55;

const HIT_TICK_HZ = 2140;
const HIT_BODY_HZ = 920;
const HIT_NOISE_FILTER_HZ = 2680;

const KILL_THUMP_HZ = 520;
const KILL_PING_HZ = 1180;

export function playHitConfirm(): void {
  AudioContextEngine.get().resume();
  const context = AudioContextEngine.get().context;
  const destination = AudioContextEngine.get().sfxInput;
  const time = context.currentTime;
  const durationS = HIT_CONFIRM_DURATION_S;

  const masterGain = context.createGain();
  scheduleExponentialDecay(masterGain.gain, time, HIT_CONFIRM_GAIN, durationS);
  masterGain.connect(destination);

  const tickOsc = context.createOscillator();
  tickOsc.type = 'triangle';
  tickOsc.frequency.setValueAtTime(HIT_TICK_HZ, time);
  tickOsc.frequency.exponentialRampToValueAtTime(HIT_TICK_HZ * 0.72, time + durationS * 0.65);

  const tickGain = context.createGain();
  tickGain.gain.value = 0.68;
  tickOsc.connect(tickGain);
  tickGain.connect(masterGain);

  const bodyOsc = context.createOscillator();
  bodyOsc.type = 'sine';
  bodyOsc.frequency.setValueAtTime(HIT_BODY_HZ, time);
  bodyOsc.frequency.exponentialRampToValueAtTime(HIT_BODY_HZ * 0.58, time + durationS);

  const bodyGain = context.createGain();
  bodyGain.gain.value = 0.22;
  bodyOsc.connect(bodyGain);
  bodyGain.connect(masterGain);

  const noiseSource = context.createBufferSource();
  noiseSource.buffer = getNoiseBuffer(context, 'empty-click');

  const noiseFilter = context.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = HIT_NOISE_FILTER_HZ;
  noiseFilter.Q.value = 1.45;

  const noiseGain = context.createGain();
  noiseGain.gain.setValueAtTime(HIT_CONFIRM_GAIN * 0.46, time);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, time + durationS * 0.52);
  noiseSource.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(masterGain);

  tickOsc.start(time);
  bodyOsc.start(time);
  noiseSource.start(time);
  tickOsc.stop(time + durationS);
  bodyOsc.stop(time + durationS);
  noiseSource.stop(time + durationS);
}


export function playKillConfirm(): void {
  AudioContextEngine.get().resume();
  const context = AudioContextEngine.get().context;
  const destination = AudioContextEngine.get().sfxInput;
  const time = context.currentTime;
  const durationS = KILL_CONFIRM_DURATION_S;

  const masterGain = context.createGain();
  scheduleExponentialDecay(masterGain.gain, time, KILL_CONFIRM_GAIN, durationS);
  masterGain.connect(destination);

  const thumpOsc = context.createOscillator();
  thumpOsc.type = 'sine';
  thumpOsc.frequency.setValueAtTime(KILL_THUMP_HZ, time);
  thumpOsc.frequency.exponentialRampToValueAtTime(KILL_THUMP_HZ * 0.42, time + durationS * 0.78);

  const thumpGain = context.createGain();
  thumpGain.gain.value = 0.62;
  thumpOsc.connect(thumpGain);
  thumpGain.connect(masterGain);

  const pingOsc = context.createOscillator();
  pingOsc.type = 'triangle';
  pingOsc.frequency.setValueAtTime(KILL_PING_HZ, time + 0.012);
  pingOsc.frequency.exponentialRampToValueAtTime(KILL_PING_HZ * 1.18, time + durationS * 0.55);

  const pingGain = context.createGain();
  pingGain.gain.setValueAtTime(0, time);
  pingGain.gain.linearRampToValueAtTime(0.48, time + 0.014);
  pingGain.gain.exponentialRampToValueAtTime(0.001, time + durationS * 0.72);
  pingOsc.connect(pingGain);
  pingGain.connect(masterGain);

  const noiseSource = context.createBufferSource();
  noiseSource.buffer = getNoiseBuffer(context, 'impact-crack');

  const noiseFilter = context.createBiquadFilter();
  noiseFilter.type = 'highpass';
  noiseFilter.frequency.value = 980;
  noiseFilter.Q.value = 0.85;

  const noiseGain = context.createGain();
  noiseGain.gain.setValueAtTime(KILL_CONFIRM_GAIN * 0.28, time);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, time + durationS * 0.34);
  noiseSource.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(masterGain);

  thumpOsc.start(time);
  pingOsc.start(time + 0.012);
  noiseSource.start(time);
  thumpOsc.stop(time + durationS);
  pingOsc.stop(time + durationS);
  noiseSource.stop(time + durationS);
}
