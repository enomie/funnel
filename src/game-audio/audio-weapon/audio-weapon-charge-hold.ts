import type { Vector3 } from 'three/webgpu';
import { getNoiseBuffer } from '../audio-noise-buffer';
import { AUDIO_VOICE_PEAK } from '../audio-config';
import { AudioContextEngine } from '../audio-mixer';
import { isWithinHearingRange, setupSpatialPanner } from '../audio-system';
import { tryBeginSpatialOneShot } from '../audio-spatial-voice';
import { playNoiseBurst, playOscBurst } from '../audio-one-shots/audio-one-shot-synth';

export interface ChargeHoldMechanicsState {
  readonly rocketMarking: boolean;
  readonly rocketMarkedCount: number;
  readonly bioHolding: boolean;
  readonly bioChargeFraction: number;
}

const ROCKET_MARK_CLICK_HZ = 1520;
const ROCKET_MARK_CLICK_S = 0.024;
const ROCKET_MARK_CLICK_GAIN = AUDIO_VOICE_PEAK * 0.95;

const BIO_RUMBLE_BASE_HZ = 44;
const BIO_RUMBLE_PEAK_HZ = 68;
const BIO_RUMBLE_IDLE_GAIN = AUDIO_VOICE_PEAK * 0.14;
const BIO_RUMBLE_PEAK_GAIN = AUDIO_VOICE_PEAK * 0.82;
const BIO_RUMBLE_NOISE_FILTER_HZ = 158;
const BIO_RUMBLE_NOISE_GAIN = 0.46;
const BIO_RUMBLE_ATTACK_S = 0.05;

interface BioRumbleNodes {
  panner: PannerNode;
  rumbleOsc: OscillatorNode;
  rumbleGain: GainNode;
  noiseSource: AudioBufferSourceNode;
  noiseFilter: BiquadFilterNode;
  noiseGain: GainNode;
}

/** RMB hold SFX at muzzle — rocket tube clicks + bio charge rumble (20 m). */
export class WeaponChargeHoldAudio {
  #lastRocketMarkedCount = 0;
  #bioRumble: BioRumbleNodes | null = null;

  sync(position: Vector3, state: ChargeHoldMechanicsState): void {
    this.#syncRocketMarks(position, state);
    this.#syncBioRumble(position, state);
  }

  stop(): void {
    this.#lastRocketMarkedCount = 0;
    this.#stopBioRumble();
  }

  isActive(): boolean {
    return this.#bioRumble !== null;
  }

  #syncRocketMarks(position: Vector3, state: ChargeHoldMechanicsState): void {
    if (!state.rocketMarking) {
      this.#lastRocketMarkedCount = 0;
      return;
    }

    if (state.rocketMarkedCount <= this.#lastRocketMarkedCount) {
      return;
    }

    this.#lastRocketMarkedCount = state.rocketMarkedCount;
    this.#playRocketMarkClick(position);
  }

  #playRocketMarkClick(position: Vector3): void {
    if (!isWithinHearingRange(position, 'near')) {
      return;
    }

    const voice = tryBeginSpatialOneShot(position, 'mechanics');
    if (voice === null) {
      return;
    }

    AudioContextEngine.get().resume();
    const context = AudioContextEngine.get().context;
    const time = context.currentTime;

    playOscBurst({
      context,
      destination: voice.input,
      time,
      frequency: ROCKET_MARK_CLICK_HZ,
      durationS: ROCKET_MARK_CLICK_S,
      volume: ROCKET_MARK_CLICK_GAIN,
      type: 'square',
      track: (...nodes) => {
        voice.track(...nodes);
      }
    });

    const scrape = playNoiseBurst({
      context,
      destination: voice.input,
      time: time + 0.006,
      durationS: ROCKET_MARK_CLICK_S * 1.1,
      volume: ROCKET_MARK_CLICK_GAIN * 0.58,
      noiseKey: 'empty-click',
      filterHz: 2280,
      track: (...nodes) => {
        voice.track(...nodes);
      }
    });

    voice.endAfter(scrape);
  }

  #syncBioRumble(position: Vector3, state: ChargeHoldMechanicsState): void {
    if (!state.bioHolding) {
      this.#stopBioRumble();
      return;
    }

    if (this.#bioRumble === null) {
      this.#startBioRumble(position, state.bioChargeFraction);
      return;
    }

    this.#updateBioRumble(position, state.bioChargeFraction);
  }

  #startBioRumble(position: Vector3, fraction: number): void {
    if (!isWithinHearingRange(position, 'near')) {
      return;
    }

    AudioContextEngine.get().resume();
    const context = AudioContextEngine.get().context;
    const time = context.currentTime;
    const gain = bioRumbleGainForFraction(fraction);

    const panner = context.createPanner();
    setupSpatialPanner(panner, 'near');
    panner.positionX.setValueAtTime(position.x, time);
    panner.positionY.setValueAtTime(position.y, time);
    panner.positionZ.setValueAtTime(position.z, time);
    panner.connect(AudioContextEngine.get().sfxInput);

    const rumbleGain = context.createGain();
    rumbleGain.gain.setValueAtTime(0.001, time);
    rumbleGain.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), time + BIO_RUMBLE_ATTACK_S);
    rumbleGain.connect(panner);

    const rumbleOsc = context.createOscillator();
    rumbleOsc.type = 'sine';
    rumbleOsc.frequency.setValueAtTime(
      BIO_RUMBLE_BASE_HZ + fraction * (BIO_RUMBLE_PEAK_HZ - BIO_RUMBLE_BASE_HZ),
      time
    );
    rumbleOsc.connect(rumbleGain);

    const noiseSource = context.createBufferSource();
    noiseSource.buffer = getNoiseBuffer(context, 'bio-rumble');
    noiseSource.loop = true;

    const noiseFilter = context.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = BIO_RUMBLE_NOISE_FILTER_HZ;
    noiseFilter.Q.value = 0.72;

    const noiseGain = context.createGain();
    noiseGain.gain.value = BIO_RUMBLE_NOISE_GAIN;
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(rumbleGain);

    rumbleOsc.start(time);
    noiseSource.start(time);

    this.#bioRumble = {
      panner,
      rumbleOsc,
      rumbleGain,
      noiseSource,
      noiseFilter,
      noiseGain
    };
  }

  #updateBioRumble(position: Vector3, fraction: number): void {
    const nodes = this.#bioRumble;
    if (nodes === null) {
      return;
    }

    const time = AudioContextEngine.get().context.currentTime;
    const gain = bioRumbleGainForFraction(fraction);

    nodes.panner.positionX.value = position.x;
    nodes.panner.positionY.value = position.y;
    nodes.panner.positionZ.value = position.z;

    nodes.rumbleGain.gain.setTargetAtTime(gain, time, 0.045);
    nodes.rumbleOsc.frequency.setTargetAtTime(
      BIO_RUMBLE_BASE_HZ + fraction * (BIO_RUMBLE_PEAK_HZ - BIO_RUMBLE_BASE_HZ),
      time,
      0.06
    );
    nodes.noiseFilter.frequency.setTargetAtTime(
      BIO_RUMBLE_NOISE_FILTER_HZ + fraction * 48,
      time,
      0.06
    );
  }

  #stopBioRumble(): void {
    const nodes = this.#bioRumble;
    if (nodes === null) {
      return;
    }

    const stopTime = AudioContextEngine.get().context.currentTime + 0.02;
    this.#stopSource(nodes.rumbleOsc, stopTime);
    this.#stopSource(nodes.noiseSource, stopTime);

    nodes.rumbleOsc.disconnect();
    nodes.noiseSource.disconnect();
    nodes.noiseFilter.disconnect();
    nodes.noiseGain.disconnect();
    nodes.rumbleGain.disconnect();
    nodes.panner.disconnect();
    this.#bioRumble = null;
  }

  #stopSource(source: OscillatorNode | AudioBufferSourceNode, stopTime: number): void {
    try {
      source.stop(stopTime);
    } catch {
      /* already stopped */
    }
  }
}

function bioRumbleGainForFraction(fraction: number): number {
  return BIO_RUMBLE_IDLE_GAIN + fraction * (BIO_RUMBLE_PEAK_GAIN - BIO_RUMBLE_IDLE_GAIN);
}
