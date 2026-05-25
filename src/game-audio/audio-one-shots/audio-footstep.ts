import { capsuleBottomOffsetY } from '../../player/player-stance';
import { getFootstepNoiseBuffer } from '../audio-noise-buffer';
import { AUDIO_VOICE_PEAK } from '../audio-config';
import { AudioContextEngine } from '../audio-mixer';
import { spatialVectorFromPoint, type AudioPoint } from '../audio-system';
import { tryBeginSpatialOneShot } from '../audio-spatial-voice';
import { scheduleExponentialDecay } from './audio-one-shot-synth';

const FOOTSTEP_STEP_DURATION_S = 0.055;
const FOOTSTEP_STOP_TAIL_S = 0.02;
const FOOTSTEP_STEP_FILTER_HZ = 980;
const FOOTSTEP_STEP_FILTER_Q = 1.15;

const _footstepOriginScratch: AudioPoint = { x: 0, y: 0, z: 0 };

/** World point at the character's lowest extent — capsule bottom hemisphere tip. */
export function fillFootstepOriginFromCapsule(
  capsuleCenter: AudioPoint,
  crouching: boolean,
  out: AudioPoint = _footstepOriginScratch
): AudioPoint {
  const bottomOffsetY = capsuleBottomOffsetY(crouching);
  out.x = capsuleCenter.x;
  out.y = capsuleCenter.y + bottomOffsetY;
  out.z = capsuleCenter.z;
  return out;
}

/** @deprecated Use `fillFootstepOriginFromCapsule`. */
export function footstepOriginFromCapsule(
  capsuleCenter: AudioPoint,
  crouching: boolean
): AudioPoint {
  return fillFootstepOriginFromCapsule(capsuleCenter, crouching);
}

/** Short ground tap while walking or sprinting. */
export function playFootstepStepAt(origin: AudioPoint): void {
  const voice = tryBeginSpatialOneShot(spatialVectorFromPoint(origin), 'foot');
  if (voice === null) {
    return;
  }

  AudioContextEngine.get().resume();
  const context = AudioContextEngine.get().context;
  const time = context.currentTime;
  const durationS = FOOTSTEP_STEP_DURATION_S;

  const source = context.createBufferSource();
  source.buffer = getFootstepNoiseBuffer(context);

  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = FOOTSTEP_STEP_FILTER_HZ;
  filter.Q.value = FOOTSTEP_STEP_FILTER_Q;

  const gain = context.createGain();
  scheduleExponentialDecay(gain.gain, time, AUDIO_VOICE_PEAK, durationS);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(voice.input);

  source.start(time);
  source.stop(time + durationS + FOOTSTEP_STOP_TAIL_S);
  voice.track(source, filter, gain);
  voice.endAfter(source);
}
