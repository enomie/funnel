// Path: /Users/johann/MyBrew/funnel-real/src/game-audio/audio-one-shots/audio-footstep-landing.ts

import { getNoiseBuffer } from '../audio-noise-buffer';
import { AUDIO_VOICE_PEAK } from '../audio-config';
import { AudioContextEngine } from '../audio-mixer';
import { spatialVectorFromPoint, type AudioPoint } from '../audio-system';
import { tryBeginSpatialOneShot } from '../audio-spatial-voice';
import { scheduleExponentialDecay } from './audio-one-shot-synth';

const FOOTSTEP_LAND_DURATION_S = 0.09;
const FOOTSTEP_STOP_TAIL_S = 0.02;
const FOOTSTEP_LAND_THUMP_HZ = 92;
const FOOTSTEP_LAND_SCRAPE_FILTER_HZ = 420;
const FOOTSTEP_LAND_SCRAPE_FILTER_Q = 0.85;


export function playFootstepLandAt(origin: AudioPoint): void {
  const voice = tryBeginSpatialOneShot(spatialVectorFromPoint(origin), 'foot');
  if (voice === null) {
    return;
  }

  AudioContextEngine.get().resume();
  const context = AudioContextEngine.get().context;
  const time = context.currentTime;
  const durationS = FOOTSTEP_LAND_DURATION_S;

  const masterGain = context.createGain();
  scheduleExponentialDecay(masterGain.gain, time, AUDIO_VOICE_PEAK, durationS);
  masterGain.connect(voice.input);

  const thumpOsc = context.createOscillator();
  thumpOsc.type = 'sine';
  thumpOsc.frequency.setValueAtTime(FOOTSTEP_LAND_THUMP_HZ, time);
  thumpOsc.frequency.exponentialRampToValueAtTime(FOOTSTEP_LAND_THUMP_HZ * 0.55, time + durationS * 0.72);

  const thumpGain = context.createGain();
  thumpGain.gain.value = 0.62;
  thumpOsc.connect(thumpGain);
  thumpGain.connect(masterGain);

  const scrapeSource = context.createBufferSource();
  scrapeSource.buffer = getNoiseBuffer(context, 'foot-scrape');

  const scrapeFilter = context.createBiquadFilter();
  scrapeFilter.type = 'bandpass';
  scrapeFilter.frequency.value = FOOTSTEP_LAND_SCRAPE_FILTER_HZ;
  scrapeFilter.Q.value = FOOTSTEP_LAND_SCRAPE_FILTER_Q;

  const scrapeGain = context.createGain();
  scrapeGain.gain.value = 0.48;
  scrapeSource.connect(scrapeFilter);
  scrapeFilter.connect(scrapeGain);
  scrapeGain.connect(masterGain);

  thumpOsc.start(time);
  scrapeSource.start(time);
  thumpOsc.stop(time + durationS);
  scrapeSource.stop(time + durationS + FOOTSTEP_STOP_TAIL_S);

  voice.track(masterGain, thumpOsc, thumpGain, scrapeSource, scrapeFilter, scrapeGain);
  voice.endAfter(thumpOsc);
}
