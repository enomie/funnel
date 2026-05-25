import type { AudioOneShotVoice } from '../audio-spatial-voice';
import { scheduleAttackHoldRelease } from './audio-one-shot-synth';
import { getNoiseBuffer } from '../audio-noise-buffer';
import { AUDIO_VOICE_PEAK } from '../audio-config';

const ROCKET_BLAST_ATTACK_S = 0.005;
const ROCKET_CRACK_DURATION_S = 0.052;
const ROCKET_NOISE_TAIL_S = 0.44;
const ROCKET_SUB_START_HZ = 94;
const ROCKET_SUB_END_HZ = 32;
const ROCKET_BODY_START_HZ = 122;
const ROCKET_BODY_END_HZ = 48;
const ROCKET_BODY_LOWPASS_START_HZ = 520;
const ROCKET_BODY_LOWPASS_END_HZ = 110;
const ROCKET_CRACK_FILTER_HZ = 1480;
const ROCKET_FIREBALL_FILTER_HZ = 340;
const ROCKET_DURATION_BASE_S = 0.46;
const ROCKET_DURATION_RADIUS_S = 0.024;

const ROCKET_MIX_SUB = 0.36;
const ROCKET_MIX_BODY = 0.22;
const ROCKET_MIX_CRACK = 0.24;
const ROCKET_MIX_FIREBALL = 0.18;

export function wireRocketImpact(options: {
  context: BaseAudioContext;
  destination: AudioNode;
  time: number;
  volume: number;
  impactRadius: number;
  track?: (...nodes: AudioNode[]) => void;
}): { anchor: OscillatorNode; endTime: number } {
  const { context, destination, time, volume, impactRadius, track } = options;
  const durationS = ROCKET_DURATION_BASE_S + impactRadius * ROCKET_DURATION_RADIUS_S;
  const endTime = time + durationS;
  const peakVolume = volume;

  const masterGain = context.createGain();
  scheduleAttackHoldRelease(
    masterGain.gain,
    time,
    peakVolume,
    ROCKET_BLAST_ATTACK_S,
    endTime - ROCKET_NOISE_TAIL_S * 0.55,
    endTime
  );
  masterGain.connect(destination);

  const subOsc = context.createOscillator();
  subOsc.type = 'sine';
  subOsc.frequency.setValueAtTime(ROCKET_SUB_START_HZ, time);
  subOsc.frequency.exponentialRampToValueAtTime(ROCKET_SUB_END_HZ, time + durationS * 0.42);

  const subGain = context.createGain();
  subGain.gain.value = ROCKET_MIX_SUB;

  const bodyOsc = context.createOscillator();
  bodyOsc.type = 'sawtooth';
  bodyOsc.frequency.setValueAtTime(ROCKET_BODY_START_HZ, time);
  bodyOsc.frequency.exponentialRampToValueAtTime(ROCKET_BODY_END_HZ, endTime);

  const bodyFilter = context.createBiquadFilter();
  bodyFilter.type = 'lowpass';
  bodyFilter.frequency.setValueAtTime(ROCKET_BODY_LOWPASS_START_HZ, time);
  bodyFilter.frequency.exponentialRampToValueAtTime(ROCKET_BODY_LOWPASS_END_HZ, endTime);
  bodyFilter.Q.value = 0.85;

  const bodyGain = context.createGain();
  bodyGain.gain.value = ROCKET_MIX_BODY;

  const crackSource = context.createBufferSource();
  crackSource.buffer = getNoiseBuffer(context, 'rocket-crack');

  const crackFilter = context.createBiquadFilter();
  crackFilter.type = 'bandpass';
  crackFilter.frequency.value = ROCKET_CRACK_FILTER_HZ;
  crackFilter.Q.value = 1.15;

  const crackGain = context.createGain();
  crackGain.gain.setValueAtTime(ROCKET_MIX_CRACK, time);
  crackGain.gain.exponentialRampToValueAtTime(0.001, time + ROCKET_CRACK_DURATION_S);

  const fireballSource = context.createBufferSource();
  fireballSource.buffer = getNoiseBuffer(context, 'rocket-fireball');

  const fireballFilter = context.createBiquadFilter();
  fireballFilter.type = 'bandpass';
  fireballFilter.frequency.value = ROCKET_FIREBALL_FILTER_HZ;
  fireballFilter.Q.value = 0.62;

  const fireballGain = context.createGain();
  fireballGain.gain.setValueAtTime(0.001, time);
  fireballGain.gain.exponentialRampToValueAtTime(ROCKET_MIX_FIREBALL, time + ROCKET_BLAST_ATTACK_S);
  fireballGain.gain.exponentialRampToValueAtTime(0.001, time + ROCKET_NOISE_TAIL_S);

  subOsc.connect(subGain);
  bodyOsc.connect(bodyFilter);
  bodyFilter.connect(bodyGain);
  subGain.connect(masterGain);
  bodyGain.connect(masterGain);
  crackSource.connect(crackFilter);
  crackFilter.connect(crackGain);
  crackGain.connect(masterGain);
  fireballSource.connect(fireballFilter);
  fireballFilter.connect(fireballGain);
  fireballGain.connect(masterGain);
  track?.(
    masterGain,
    subOsc,
    subGain,
    bodyOsc,
    bodyFilter,
    bodyGain,
    crackSource,
    crackFilter,
    crackGain,
    fireballSource,
    fireballFilter,
    fireballGain
  );

  subOsc.start(time);
  bodyOsc.start(time);
  crackSource.start(time);
  fireballSource.start(time);
  subOsc.stop(endTime);
  bodyOsc.stop(endTime);
  crackSource.stop(time + ROCKET_CRACK_DURATION_S);
  fireballSource.stop(time + ROCKET_NOISE_TAIL_S);

  return { anchor: subOsc, endTime };
}

export function rocketImpactPhraseDuration(impactRadius: number): number {
  return ROCKET_DURATION_BASE_S + impactRadius * ROCKET_DURATION_RADIUS_S + 0.02;
}

export function scheduleRocketImpactPhrase(
  impactRadius: number,
  gainScale: number,
  startTime: number,
  context: BaseAudioContext,
  destination: AudioNode
): number {
  wireRocketImpact({
    context,
    destination,
    time: startTime,
    volume: AUDIO_VOICE_PEAK * gainScale,
    impactRadius
  });
  return rocketImpactPhraseDuration(impactRadius);
}

export function playRocketImpact(options: {
  context: AudioContext;
  destination: AudioNode;
  time: number;
  peak: number;
  impactRadius: number;
  voice: AudioOneShotVoice;
}): void {
  const { context, destination, time, peak, impactRadius, voice } = options;
  const { anchor } = wireRocketImpact({
    context,
    destination,
    time,
    volume: peak,
    impactRadius,
    track: voice.track.bind(voice)
  });
  voice.endAfter(anchor);
}
