// Path: /Users/johann/MyBrew/funnel-real/src/game-audio/audio-mixer.ts

import { AUDIO_MASTER_GAIN } from './audio-config';
import { attachAudioContextStateLogger } from './audio-debug';
import { markAudioPermanentlyDead, tryResumeGameAudio } from './audio-guard';

const SFX_LIMITER_THRESHOLD = -10;
const SFX_LIMITER_RATIO = 12;

let shared: AudioContextEngine | null = null;


export class AudioContextEngine {
  #context: AudioContext | null = null;
  #sfxInput: GainNode | null = null;

  private constructor() {}

  #ensureInitialized(): void {
    if (this.#context !== null && this.#sfxInput !== null) {
      return;
    }

    const context = new AudioContext({ latencyHint: 'interactive' });
    const masterGain = context.createGain();
    masterGain.gain.value = AUDIO_MASTER_GAIN;

    const sfxInput = context.createGain();
    sfxInput.gain.value = 1;

    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = SFX_LIMITER_THRESHOLD;
    limiter.knee.value = 2;
    limiter.ratio.value = SFX_LIMITER_RATIO;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.1;

    sfxInput.connect(limiter);
    limiter.connect(masterGain);
    masterGain.connect(context.destination);

    attachAudioContextStateLogger(context, (reason) => {
      if (reason === 'closed' || reason === 'closed-at-init') {
        markAudioPermanentlyDead(`AudioContext statechange: ${reason}`);
      }
    });

    this.#context = context;
    this.#sfxInput = sfxInput;
  }

  static get(): AudioContextEngine {
    shared ??= new AudioContextEngine();
    return shared;
  }

  get isInitialized(): boolean {
    return this.#context !== null;
  }

  get context(): AudioContext {
    this.#ensureInitialized();
    if (this.#context === null) {
      throw new Error('FUNNEL audio context failed to initialize.');
    }
    return this.#context;
  }

  get sfxInput(): AudioNode {
    this.#ensureInitialized();
    if (this.#sfxInput === null) {
      throw new Error('FUNNEL audio bus failed to initialize.');
    }
    return this.#sfxInput;
  }

  resume(): void {
    tryResumeGameAudio();
  }
}
