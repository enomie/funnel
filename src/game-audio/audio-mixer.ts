// Path: /Users/johann/MyBrew/funnel-real/src/game-audio/audio-mixer.ts

import { AUDIO_MASTER_GAIN } from './audio-config';
import { attachAudioContextStateLogger } from './audio-debug';
import { markAudioPermanentlyDead, tryResumeGameAudio } from './audio-guard';

const SFX_LIMITER_THRESHOLD = -10;
const SFX_LIMITER_RATIO = 12;

let shared: AudioContextEngine | null = null;


export class AudioContextEngine {
  readonly #context: AudioContext;
  readonly #masterGain: GainNode;
  readonly #sfxInput: GainNode;

  private constructor() {
    this.#context = new AudioContext({ latencyHint: 'interactive' });
    this.#masterGain = this.#context.createGain();
    this.#masterGain.gain.value = AUDIO_MASTER_GAIN;

    this.#sfxInput = this.#context.createGain();
    this.#sfxInput.gain.value = 1;

    const limiter = this.#context.createDynamicsCompressor();
    limiter.threshold.value = SFX_LIMITER_THRESHOLD;
    limiter.knee.value = 2;
    limiter.ratio.value = SFX_LIMITER_RATIO;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.1;

    this.#sfxInput.connect(limiter);
    limiter.connect(this.#masterGain);
    this.#masterGain.connect(this.#context.destination);

    attachAudioContextStateLogger(this.#context, (reason) => {
      if (reason === 'closed' || reason === 'closed-at-init') {
        markAudioPermanentlyDead(`AudioContext statechange: ${reason}`);
      }
    });
  }

  static get(): AudioContextEngine {
    shared ??= new AudioContextEngine();
    return shared;
  }

  get context(): AudioContext {
    return this.#context;
  }

  get sfxInput(): AudioNode {
    return this.#sfxInput;
  }

  resume(): void {
    tryResumeGameAudio();
  }
}
