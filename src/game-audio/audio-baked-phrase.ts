export interface BakedPhrase {
  buffer: AudioBuffer;
  durationS: number;
}

export type BakeScheduleFn = (context: OfflineAudioContext, output: GainNode) => void;

let sharedCache: BakedPhraseCache | null = null;

export function getBakedPhraseCache(): BakedPhraseCache {
  sharedCache ??= new BakedPhraseCache();
  return sharedCache;
}

/** Offline-rendered one-shots — fire, impact, grunts, dry-fire. */
export class BakedPhraseCache {
  readonly #cache = new Map<string, BakedPhrase>();
  readonly #cap: number;

  constructor(cap = 160) {
    this.#cap = cap;
  }

  get(key: string): BakedPhrase | undefined {
    return this.#cache.get(key);
  }

  has(key: string): boolean {
    return this.#cache.has(key);
  }

  set(key: string, phrase: BakedPhrase): void {
    if (!this.#cache.has(key) && this.#cache.size >= this.#cap) {
      const oldestKey = this.#cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.#cache.delete(oldestKey);
      }
    }
    this.#cache.set(key, phrase);
  }

  async bake(sampleRate: number, durationS: number, schedule: BakeScheduleFn): Promise<BakedPhrase> {
    const frameCount = Math.ceil((durationS + 0.05) * sampleRate);
    const offline = new OfflineAudioContext(1, frameCount, sampleRate);
    const output = offline.createGain();
    output.connect(offline.destination);
    schedule(offline, output);
    const buffer = await offline.startRendering();
    return { buffer, durationS };
  }

  async getOrBake(
    key: string,
    sampleRate: number,
    durationS: number,
    schedule: BakeScheduleFn
  ): Promise<BakedPhrase> {
    const cached = this.#cache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const phrase = await this.bake(sampleRate, durationS, schedule);
    this.set(key, phrase);
    return phrase;
  }
}

export interface PlayedBakedPhrase {
  source: AudioBufferSourceNode;
  gainNode: GainNode;
}

export function playBakedPhrase(
  context: AudioContext,
  phrase: BakedPhrase,
  destination: AudioNode,
  gain = 1
): PlayedBakedPhrase {
  const source = context.createBufferSource();
  source.buffer = phrase.buffer;
  const gainNode = context.createGain();
  gainNode.gain.value = gain;
  source.connect(gainNode);
  gainNode.connect(destination);
  const time = context.currentTime;
  source.start(time);
  source.stop(time + phrase.durationS + 0.02);
  return { source, gainNode };
}

/** Silent tail so a voice lease survives until a live-scheduled phrase ends. */
export function scheduleVoiceTail(
  context: AudioContext,
  destination: AudioNode,
  durationS: number
): OscillatorNode {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  gain.gain.value = 0.0001;
  oscillator.connect(gain);
  gain.connect(destination);
  const start = context.currentTime + 0.001;
  oscillator.start(start);
  oscillator.stop(start + durationS);
  return oscillator;
}
