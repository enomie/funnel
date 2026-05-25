import type { FireProfile } from '../../combat/weapon-definitions';
import type { FireAudioPreset } from '../audio-weapon/audio-fire-preset';
import { AUDIO_VOICE_PEAK } from '../audio-config';
import { playOscBurst } from './audio-one-shot-synth';

/** Schedule weapon fire synth at `startTime` — returns phrase duration (s). */
export function scheduleFirePhrase(
  context: BaseAudioContext,
  destination: AudioNode,
  preset: FireAudioPreset,
  fire: FireProfile,
  startTime: number
): number {
  const time = startTime;
  let durationS = preset.fireDurationS;

  playOscBurst({
    context,
    destination,
    time,
    frequency: preset.fireBaseHz,
    durationS: preset.fireDurationS,
    volume: AUDIO_VOICE_PEAK,
    type: preset.fireWave
  });
  playOscBurst({
    context,
    destination,
    time,
    frequency: preset.fireBaseHz * preset.fireHarmonicRatio,
    durationS: preset.fireDurationS * 0.72,
    volume: AUDIO_VOICE_PEAK * 0.55,
    type: preset.harmonicWave
  });
  durationS = Math.max(durationS, preset.fireDurationS * 0.72);

  if (fire.projectileCount > 1) {
    const spreadGain = Math.min(0.35, fire.projectileCount * 0.03);
    const spreadDurationS = preset.fireDurationS * 1.1;
    playOscBurst({
      context,
      destination,
      time: time + 0.012,
      frequency: preset.fireBaseHz * 0.82,
      durationS: spreadDurationS,
      volume: AUDIO_VOICE_PEAK * spreadGain,
      type: 'square'
    });
    durationS = Math.max(durationS, 0.012 + spreadDurationS);
  }

  return durationS + 0.02;
}
