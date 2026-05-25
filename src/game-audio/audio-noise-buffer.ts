/** Procedural noise clips — one cache entry per shape. */

import { BAKED_NOISE_PEAK } from './audio-config';

export type NoiseBufferKey =
  | 'impact-crack'
  | 'empty-click'
  | 'rocket-crack'
  | 'rocket-fireball'
  | 'redeemer-blast'
  | 'foot-scrape'
  | 'bio-rumble';

const cache = new Map<NoiseBufferKey, AudioBuffer>();

const FOOTSTEP_VARIANTS = 12;
const FOOTSTEP_BAKE_DURATION_S = 0.12;

let footstepVariants: AudioBuffer[] | null = null;
let footstepVariantPick = 0;

export function getNoiseBuffer(context: BaseAudioContext, key: NoiseBufferKey): AudioBuffer {
  const existing = cache.get(key);
  if (existing !== undefined) {
    return existing;
  }

  const buffer = bakeNoiseBuffer(context, key);
  cache.set(key, buffer);
  return buffer;
}

export function getFootstepNoiseBuffer(context: BaseAudioContext): AudioBuffer {
  if (footstepVariants === null) {
    footstepVariants = new Array(FOOTSTEP_VARIANTS);
    for (let variant = 0; variant < FOOTSTEP_VARIANTS; variant += 1) {
      footstepVariants[variant] = bakeFootstepVariant(context, variant);
    }
  }

  const buffer = footstepVariants[footstepVariantPick];
  footstepVariantPick = (footstepVariantPick + 1) % FOOTSTEP_VARIANTS;
  return buffer;
}

function bakeNoiseBuffer(context: BaseAudioContext, key: NoiseBufferKey): AudioBuffer {
  switch (key) {
    case 'impact-crack':
      return bakeDecayNoise(context, 0.06, (progress) => {
        const attack = progress < 0.06 ? progress / 0.06 : 1;
        const decay = 1 - progress;
        return attack * decay * decay * decay;
      }, BAKED_NOISE_PEAK);
    case 'empty-click':
      return bakeDecayNoise(context, 0.04, (progress) => {
        const decay = 1 - progress;
        return decay * decay;
      });
    case 'rocket-crack':
      return bakeDecayNoise(context, 0.06, (progress) => {
        const decay = 1 - progress;
        return decay * decay * decay;
      }, BAKED_NOISE_PEAK);
    case 'rocket-fireball':
      return bakeFlatNoise(context, 0.5, BAKED_NOISE_PEAK);
    case 'redeemer-blast':
      return bakeFlatNoise(context, 0.48, BAKED_NOISE_PEAK);
    case 'foot-scrape':
      return bakeDecayNoise(context, 0.07, (progress) => 1 - progress);
    case 'bio-rumble':
      return bakeFlatNoise(context, 0.18, BAKED_NOISE_PEAK);
    default:
      return bakeFlatNoise(context, 0.05);
  }
}

function bakeFlatNoise(context: BaseAudioContext, durationS: number, peak = 1): AudioBuffer {
  const sampleCount = Math.floor(context.sampleRate * durationS);
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < sampleCount; index += 1) {
    data[index] = (Math.random() * 2 - 1) * peak;
  }
  return buffer;
}

function bakeDecayNoise(
  context: BaseAudioContext,
  durationS: number,
  envelope: (progress: number) => number,
  peak = 1
): AudioBuffer {
  const sampleCount = Math.floor(context.sampleRate * durationS);
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
  const data = buffer.getChannelData(0);
  let maxPeak = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const progress = index / sampleCount;
    const sample = (Math.random() * 2 - 1) * envelope(progress);
    data[index] = sample;
    maxPeak = Math.max(maxPeak, Math.abs(sample));
  }
  if (peak < 1 && maxPeak > 0.0001) {
    const norm = peak / maxPeak;
    for (let index = 0; index < sampleCount; index += 1) {
      data[index] *= norm;
    }
  }
  return buffer;
}

function bakeFootstepVariant(context: BaseAudioContext, variantIndex: number): AudioBuffer {
  const sampleCount = Math.floor(context.sampleRate * FOOTSTEP_BAKE_DURATION_S);
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
  const data = buffer.getChannelData(0);

  let seed = variantIndex * 7919 + 17;
  const rand = (): number => {
    seed = (seed * 16807) % 2147483647;
    return (seed / 2147483647) * 2 - 1;
  };

  let pinkB0 = 0;
  let pinkB1 = 0;
  let pinkB2 = 0;
  let peak = 0;

  for (let index = 0; index < sampleCount; index += 1) {
    const white = rand();
    pinkB0 = 0.99765 * pinkB0 + white * 0.099046;
    pinkB1 = 0.963 * pinkB1 + white * 0.2965164;
    pinkB2 = 0.57 * pinkB2 + white * 1.0526913;
    const pink = pinkB0 + pinkB1 + pinkB2 + white * 0.1848;
    data[index] = pink;
    peak = Math.max(peak, Math.abs(pink));
  }

  if (peak > 0.0001) {
    const norm = BAKED_NOISE_PEAK / peak;
    for (let index = 0; index < sampleCount; index += 1) {
      data[index] *= norm;
    }
  }

  return buffer;
}
