// Path: /Users/johann/MyBrew/funnel-real/src/game-audio/audio-weapon/audio-weapon-charge-hold.ts

import type { Vector3 } from 'three/webgpu';
import { getNoiseBuffer } from '../audio-noise-buffer';
import { AUDIO_VOICE_PEAK } from '../audio-config';
import {
  isAudioAlive,
  registerAudioSilenceHook,
  safeConnect,
  safeCreateNode,
  safeStart,
  safeStop
} from '../audio-guard';
import { AudioContextEngine } from '../audio-mixer';
import { isWithinHearingRange } from '../audio-system';
import { setAudioParamImmediate } from '../audio-spatial-sync';
import { tryBeginSpatialOneShot, tryBeginSustainedSpatialVoice, type SustainedSpatialVoice } from '../audio-spatial-voice';
import { scheduleExponentialDecay } from '../audio-one-shots/audio-one-shot-synth';

export interface ChargeHoldMechanicsState {
  readonly rocketMarking: boolean;
  readonly rocketMarkedCount: number;
  readonly bioHolding: boolean;
  readonly bioChargeFraction: number;
}

const ROCKET_MARK_CLICK_S = 0.016;
const ROCKET_MARK_CLICK_GAIN = AUDIO_VOICE_PEAK * 0.95;
const ROCKET_MARK_TICK_START_HZ = 2480;
const ROCKET_MARK_TICK_END_HZ = 920;
const ROCKET_MARK_BODY_START_HZ = 780;
const ROCKET_MARK_BODY_END_HZ = 430;

const BIO_RUMBLE_BASE_HZ = 44;
const BIO_RUMBLE_PEAK_HZ = 68;
const BIO_RUMBLE_IDLE_GAIN = AUDIO_VOICE_PEAK * 0.14;
const BIO_RUMBLE_PEAK_GAIN = AUDIO_VOICE_PEAK * 0.82;
const BIO_RUMBLE_NOISE_FILTER_HZ = 158;
const BIO_RUMBLE_NOISE_GAIN = 0.46;

interface BioHoldVoice {
  release: () => void;
  syncPosition: (position: Vector3) => void;
  rumbleOsc: OscillatorNode;
  rumbleGain: GainNode;
  noiseFilter: BiquadFilterNode;
}


export class WeaponChargeHoldAudio {
  #lastRocketMarkedCount = 0;
  #bioHold: BioHoldVoice | null = null;

  constructor() {
    registerAudioSilenceHook(() => {
      this.stop();
    });
  }

  sync(position: Vector3, state: ChargeHoldMechanicsState): void {
    if (!isAudioAlive()) {
      this.stop();
      return;
    }

    this.#syncRocketMarks(position, state);
    this.#syncBioRumble(position, state);
  }

  stop(): void {
    this.#lastRocketMarkedCount = 0;
    this.#stopBioRumble();
  }

  isActive(): boolean {
    return this.#bioHold !== null;
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

    const tick = scheduleRocketMarkClickPhrase(context, voice.input, time, (...nodes) => {
      voice.track(...nodes);
    });

    voice.endAfter(tick);
  }

  #syncBioRumble(position: Vector3, state: ChargeHoldMechanicsState): void {
    if (!state.bioHolding) {
      this.#stopBioRumble();
      return;
    }

    if (this.#bioHold === null) {
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
    const sustained = tryBeginSustainedSpatialVoice(position, 'mechanics-hold', 'near');
    if (sustained === null) {
      return;
    }

    const hold = wireBioHoldGraph(sustained, fraction);
    if (hold === null) {
      sustained.release();
      return;
    }

    sustained.onAutoRelease(() => {
      this.#bioHold = null;
    });

    this.#bioHold = hold;
  }

  #updateBioRumble(position: Vector3, fraction: number): void {
    const hold = this.#bioHold;
    if (hold === null) {
      return;
    }

    const gain = bioRumbleGainForFraction(fraction);

    hold.syncPosition(position);
    setAudioParamImmediate(hold.rumbleGain.gain, gain);
    setAudioParamImmediate(
      hold.rumbleOsc.frequency,
      BIO_RUMBLE_BASE_HZ + fraction * (BIO_RUMBLE_PEAK_HZ - BIO_RUMBLE_BASE_HZ)
    );
    setAudioParamImmediate(hold.noiseFilter.frequency, BIO_RUMBLE_NOISE_FILTER_HZ + fraction * 48);
  }

  #stopBioRumble(): void {
    const hold = this.#bioHold;
    if (hold === null) {
      return;
    }

    hold.release();
    this.#bioHold = null;
  }
}

function wireBioHoldGraph(sustained: SustainedSpatialVoice, fraction: number): BioHoldVoice | null {
  const context = AudioContextEngine.get().context;
  const time = context.currentTime;
  const gain = bioRumbleGainForFraction(fraction);
  const hz = BIO_RUMBLE_BASE_HZ + fraction * (BIO_RUMBLE_PEAK_HZ - BIO_RUMBLE_BASE_HZ);

  const rumbleGain = safeCreateNode('bio-rumble-gain', () => context.createGain());
  if (rumbleGain === null) {
    return null;
  }

  setAudioParamImmediate(rumbleGain.gain, gain);
  if (!safeConnect(rumbleGain, sustained.input, 'bio-rumble-gain-input')) {
    return null;
  }

  const rumbleOsc = safeCreateNode('bio-rumble-osc', () => context.createOscillator());
  if (rumbleOsc === null) {
    return null;
  }

  rumbleOsc.type = 'sine';
  setAudioParamImmediate(rumbleOsc.frequency, hz);
  if (!safeConnect(rumbleOsc, rumbleGain, 'bio-rumble-osc-gain')) {
    return null;
  }

  const noiseSource = safeCreateNode('bio-rumble-noise', () => context.createBufferSource());
  if (noiseSource === null) {
    return null;
  }

  noiseSource.buffer = getNoiseBuffer(context, 'bio-rumble');
  noiseSource.loop = true;

  const noiseFilter = safeCreateNode('bio-rumble-filter', () => context.createBiquadFilter());
  if (noiseFilter === null) {
    return null;
  }

  noiseFilter.type = 'lowpass';
  setAudioParamImmediate(noiseFilter.frequency, BIO_RUMBLE_NOISE_FILTER_HZ + fraction * 48);
  noiseFilter.Q.value = 0.72;

  const noiseGain = safeCreateNode('bio-rumble-noise-gain', () => context.createGain());
  if (noiseGain === null) {
    return null;
  }

  noiseGain.gain.value = BIO_RUMBLE_NOISE_GAIN;
  if (
    !safeConnect(noiseSource, noiseFilter, 'bio-rumble-noise-filter') ||
    !safeConnect(noiseFilter, noiseGain, 'bio-rumble-filter-gain') ||
    !safeConnect(noiseGain, rumbleGain, 'bio-rumble-noise-gain')
  ) {
    return null;
  }

  if (!safeStart(rumbleOsc, time, 'bio-rumble-osc-start')) {
    return null;
  }

  if (!safeStart(noiseSource, time, 'bio-rumble-noise-start')) {
    safeStop(rumbleOsc, time + 0.01, 'bio-rumble-osc-rollback');
    return null;
  }

  sustained.track(rumbleGain, rumbleOsc, noiseSource, noiseFilter, noiseGain);

  return {
    release: () => {
      sustained.release();
    },
    syncPosition: (position) => {
      sustained.syncPosition(position);
    },
    rumbleOsc,
    rumbleGain,
    noiseFilter
  };
}

function bioRumbleGainForFraction(fraction: number): number {
  return BIO_RUMBLE_IDLE_GAIN + fraction * (BIO_RUMBLE_PEAK_GAIN - BIO_RUMBLE_IDLE_GAIN);
}

function scheduleRocketMarkClickPhrase(
  context: BaseAudioContext,
  destination: AudioNode,
  startTime: number,
  track: (...nodes: AudioNode[]) => void
): OscillatorNode {
  const time = startTime;
  const durationS = ROCKET_MARK_CLICK_S;

  const masterGain = context.createGain();
  scheduleExponentialDecay(masterGain.gain, time, ROCKET_MARK_CLICK_GAIN, durationS);
  masterGain.connect(destination);

  const tickOsc = context.createOscillator();
  tickOsc.type = 'sine';
  tickOsc.frequency.setValueAtTime(ROCKET_MARK_TICK_START_HZ, time);
  tickOsc.frequency.exponentialRampToValueAtTime(
    Math.max(0.001, ROCKET_MARK_TICK_END_HZ),
    time + durationS * 0.82
  );

  const tickGain = context.createGain();
  tickGain.gain.value = 0.94;
  tickOsc.connect(tickGain);
  tickGain.connect(masterGain);

  const bodyOsc = context.createOscillator();
  bodyOsc.type = 'triangle';
  bodyOsc.frequency.setValueAtTime(ROCKET_MARK_BODY_START_HZ, time);
  bodyOsc.frequency.exponentialRampToValueAtTime(
    Math.max(0.001, ROCKET_MARK_BODY_END_HZ),
    time + durationS
  );

  const bodyGain = context.createGain();
  bodyGain.gain.value = 0.22;
  bodyOsc.connect(bodyGain);
  bodyGain.connect(masterGain);

  track(masterGain, tickOsc, tickGain, bodyOsc, bodyGain);
  tickOsc.start(time);
  bodyOsc.start(time);
  tickOsc.stop(time + durationS);
  bodyOsc.stop(time + durationS);

  return tickOsc;
}
