// Path: /Users/johann/MyBrew/funnel-real/src/game-audio/audio-one-shots/audio-fire-sniper.ts

import { AUDIO_VOICE_PEAK } from '../audio-config';
import { playNoiseBurst, playOscBurst, playSweepOscBurst } from './audio-one-shot-synth';

const SNIPER_FIRE_CRACK_DURATION_S = 0.058;
const SNIPER_FIRE_BODY_DURATION_S = 0.11;
const SNIPER_FIRE_TAIL_S = 0.02;

export function sniperFirePhraseDuration(): number {
  return SNIPER_FIRE_BODY_DURATION_S + SNIPER_FIRE_TAIL_S;
}

export function scheduleSniperFirePhrase(
  context: BaseAudioContext,
  destination: AudioNode,
  startTime: number
): number {
  const time = startTime;
  const volume = AUDIO_VOICE_PEAK;

  playNoiseBurst({
    context,
    destination,
    time,
    durationS: SNIPER_FIRE_CRACK_DURATION_S,
    volume: volume * 0.94,
    noiseKey: 'impact-crack',
    filterHz: 2380,
    filterQ: 1.42,
    attackS: 0.001
  });

  playSweepOscBurst({
    context,
    destination,
    time,
    startHz: 192,
    endHz: 68,
    durationS: SNIPER_FIRE_BODY_DURATION_S,
    volume: volume * 0.58,
    type: 'sine'
  });

  playOscBurst({
    context,
    destination,
    time: time + 0.006,
    frequency: 720,
    durationS: 0.032,
    volume: volume * 0.2,
    type: 'triangle'
  });

  return sniperFirePhraseDuration();
}
