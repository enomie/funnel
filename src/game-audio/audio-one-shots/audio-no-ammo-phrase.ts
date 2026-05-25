import { getNoiseBuffer } from '../audio-noise-buffer';
import { AUDIO_VOICE_PEAK } from '../audio-config';
import { scheduleExponentialDecay } from './audio-one-shot-synth';

export const NO_AMMO_PHRASE_DURATION_S = 0.032;
const NO_AMMO_CLICK_HZ = 1580;
const NO_AMMO_SPRING_HZ = 610;
const NO_AMMO_NOISE_FILTER_HZ = 1950;

export function scheduleNoAmmoPhrase(
  context: BaseAudioContext,
  destination: AudioNode,
  startTime: number
): void {
  const time = startTime;
  const durationS = NO_AMMO_PHRASE_DURATION_S;

  const masterGain = context.createGain();
  scheduleExponentialDecay(masterGain.gain, time, AUDIO_VOICE_PEAK, durationS);
  masterGain.connect(destination);

  const clickOsc = context.createOscillator();
  clickOsc.type = 'square';
  clickOsc.frequency.setValueAtTime(NO_AMMO_CLICK_HZ, time);
  clickOsc.frequency.exponentialRampToValueAtTime(NO_AMMO_CLICK_HZ * 0.62, time + durationS * 0.72);

  const clickGain = context.createGain();
  clickGain.gain.value = 0.74;
  clickOsc.connect(clickGain);
  clickGain.connect(masterGain);

  const springOsc = context.createOscillator();
  springOsc.type = 'triangle';
  springOsc.frequency.setValueAtTime(NO_AMMO_SPRING_HZ, time);
  springOsc.frequency.exponentialRampToValueAtTime(NO_AMMO_SPRING_HZ * 0.48, time + durationS);

  const springGain = context.createGain();
  springGain.gain.value = 0.26;
  springOsc.connect(springGain);
  springGain.connect(masterGain);

  const noiseSource = context.createBufferSource();
  noiseSource.buffer = getNoiseBuffer(context, 'empty-click');

  const noiseFilter = context.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = NO_AMMO_NOISE_FILTER_HZ;
  noiseFilter.Q.value = 1.25;

  const noiseGain = context.createGain();
  noiseGain.gain.setValueAtTime(AUDIO_VOICE_PEAK * 0.52, time);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, time + durationS * 0.55);
  noiseSource.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(masterGain);

  clickOsc.start(time);
  springOsc.start(time);
  noiseSource.start(time);
  clickOsc.stop(time + durationS);
  springOsc.stop(time + durationS);
  noiseSource.stop(time + durationS);
}
