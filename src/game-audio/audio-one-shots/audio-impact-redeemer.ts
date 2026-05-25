// Path: /Users/johann/MyBrew/funnel-real/src/game-audio/audio-one-shots/audio-impact-redeemer.ts

import type { Vector3 } from 'three/webgpu';
import { REDEEMER_IMPACT_EXPAND_MS } from '../../combat/weapon-definitions';
import { AUDIO_VOICE_PEAK } from '../audio-config';
import { AudioContextEngine } from '../audio-mixer';
import {
  releaseSpatialOneShotHandle,
  tryBeginSpatialOneShot
} from '../audio-spatial-voice';
import { playNoiseBurst, scheduleAttackHoldRelease } from './audio-one-shot-synth';

const BLAST_DURATION_S = REDEEMER_IMPACT_EXPAND_MS / 1000;
const BLAST_ATTACK_S = 0.18;
const BLAST_RELEASE_S = 0.72;
const BLAST_SUB_HZ = 36;
const BLAST_BODY_HZ = 74;
const BLAST_NOISE_FILTER_HZ = 260;


export function attachRedeemerBlastSpread(position: Vector3, gainScale: number): number | null {
  const voice = tryBeginSpatialOneShot(position, 'redeemer-blast', 'mapWide');
  if (voice === null) {
    return null;
  }

  AudioContextEngine.get().resume();
  const context = AudioContextEngine.get().context;
  const time = context.currentTime;
  const endTime = time + BLAST_DURATION_S;
  const peakVolume = AUDIO_VOICE_PEAK * gainScale;

  const anchor = wireRedeemerBlastSpread({
    context,
    destination: voice.input,
    time,
    endTime,
    peakVolume,
    track: (...nodes) => {
      voice.track(...nodes);
    }
  });
  voice.endAfter(anchor);
  return voice.handle;
}

export function detachRedeemerBlastSpread(handle: number): void {
  releaseSpatialOneShotHandle(handle);
}

function wireRedeemerBlastSpread(options: {
  context: BaseAudioContext;
  destination: AudioNode;
  time: number;
  endTime: number;
  peakVolume: number;
  track?: (...nodes: AudioNode[]) => void;
}): OscillatorNode {
  const { context, destination, time, endTime, peakVolume, track } = options;

  const masterGain = context.createGain();
  scheduleAttackHoldRelease(
    masterGain.gain,
    time,
    peakVolume,
    BLAST_ATTACK_S,
    endTime - BLAST_RELEASE_S,
    endTime
  );
  masterGain.connect(destination);

  const subOsc = context.createOscillator();
  subOsc.type = 'sawtooth';
  subOsc.frequency.setValueAtTime(BLAST_SUB_HZ, time);
  subOsc.frequency.exponentialRampToValueAtTime(BLAST_SUB_HZ * 0.62, endTime);

  const subGain = context.createGain();
  subGain.gain.value = 0.48;
  subOsc.connect(subGain);
  subGain.connect(masterGain);

  const bodyOsc = context.createOscillator();
  bodyOsc.type = 'triangle';
  bodyOsc.frequency.setValueAtTime(BLAST_BODY_HZ, time);
  bodyOsc.frequency.exponentialRampToValueAtTime(BLAST_BODY_HZ * 0.55, endTime);

  const bodyGain = context.createGain();
  bodyGain.gain.value = 0.32;
  bodyOsc.connect(bodyGain);
  bodyGain.connect(masterGain);

  playNoiseBurst({
    context,
    destination: masterGain,
    time,
    durationS: BLAST_DURATION_S * 0.88,
    volume: 0.38,
    noiseKey: 'redeemer-blast',
    filterHz: BLAST_NOISE_FILTER_HZ,
    filterQ: 0.58,
    attackS: 0.12,
    track
  });

  track?.(masterGain, subOsc, subGain, bodyOsc, bodyGain);

  subOsc.start(time);
  bodyOsc.start(time);
  subOsc.stop(endTime);
  bodyOsc.stop(endTime);

  return subOsc;
}
