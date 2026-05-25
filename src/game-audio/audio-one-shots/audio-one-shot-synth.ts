import { getNoiseBuffer, type NoiseBufferKey } from '../audio-noise-buffer';

const MIN_GAIN = 0.001;

export function scheduleExponentialDecay(
  param: AudioParam,
  time: number,
  peak: number,
  durationS: number
): void {
  param.cancelScheduledValues(time);
  param.setValueAtTime(Math.max(MIN_GAIN, peak), time);
  param.exponentialRampToValueAtTime(MIN_GAIN, time + durationS);
}

export function scheduleAttackHoldRelease(
  param: AudioParam,
  time: number,
  peak: number,
  attackS: number,
  holdUntil: number,
  releaseEnd: number
): void {
  param.cancelScheduledValues(time);
  param.setValueAtTime(MIN_GAIN, time);
  param.exponentialRampToValueAtTime(Math.max(MIN_GAIN, peak), time + attackS);
  param.setValueAtTime(Math.max(MIN_GAIN, peak), holdUntil);
  param.exponentialRampToValueAtTime(MIN_GAIN, releaseEnd);
}

export function playOscBurst(options: {
  context: BaseAudioContext;
  destination: AudioNode;
  time: number;
  frequency: number;
  durationS: number;
  volume: number;
  type: OscillatorType;
  track?: (...nodes: AudioNode[]) => void;
}): OscillatorNode {
  const { context, destination, time, frequency, durationS, volume, type, track } = options;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, time);
  scheduleExponentialDecay(gain.gain, time, volume, durationS);
  oscillator.connect(gain);
  gain.connect(destination);
  track?.(oscillator, gain);
  oscillator.start(time);
  oscillator.stop(time + durationS);
  return oscillator;
}

/** Percussive thump / body — pitch drops while gain decays (footstep, bullet impact). */
export function playSweepOscBurst(options: {
  context: BaseAudioContext;
  destination: AudioNode;
  time: number;
  startHz: number;
  endHz: number;
  durationS: number;
  volume: number;
  type?: OscillatorType;
  lowpassStartHz?: number;
  lowpassEndHz?: number;
  track?: (...nodes: AudioNode[]) => void;
}): OscillatorNode {
  const {
    context,
    destination,
    time,
    startHz,
    endHz,
    durationS,
    volume,
    type = 'sine',
    lowpassStartHz,
    lowpassEndHz,
    track
  } = options;

  const oscillator = context.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(startHz, time);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(MIN_GAIN, endHz), time + durationS * 0.72);

  const gain = context.createGain();
  scheduleExponentialDecay(gain.gain, time, volume, durationS);

  if (lowpassStartHz !== undefined && lowpassEndHz !== undefined) {
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(lowpassStartHz, time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(MIN_GAIN, lowpassEndHz), time + durationS);
    filter.Q.value = 0.85;
    oscillator.connect(filter);
    filter.connect(gain);
    track?.(oscillator, filter, gain);
  } else {
    oscillator.connect(gain);
    track?.(oscillator, gain);
  }

  gain.connect(destination);
  oscillator.start(time);
  oscillator.stop(time + durationS);
  return oscillator;
}

export function playNoiseBurst(options: {
  context: BaseAudioContext;
  destination: AudioNode;
  time: number;
  durationS: number;
  volume: number;
  noiseKey: NoiseBufferKey;
  filterHz?: number;
  filterQ?: number;
  attackS?: number;
  track?: (...nodes: AudioNode[]) => void;
}): AudioBufferSourceNode {
  const {
    context,
    destination,
    time,
    durationS,
    volume,
    noiseKey,
    filterHz = 1800,
    filterQ = 0.9,
    attackS = 0,
    track
  } = options;

  const source = context.createBufferSource();
  source.buffer = getNoiseBuffer(context, noiseKey);

  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = filterHz;
  filter.Q.value = filterQ;

  const gain = context.createGain();
  if (attackS > 0) {
    scheduleAttackHoldRelease(
      gain.gain,
      time,
      volume,
      attackS,
      time + attackS,
      time + durationS
    );
  } else {
    scheduleExponentialDecay(gain.gain, time, volume, durationS);
  }

  source.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  track?.(source, filter, gain);
  source.start(time);
  source.stop(time + durationS);
  return source;
}
