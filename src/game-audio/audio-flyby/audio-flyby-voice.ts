import { Vector3 } from 'three/webgpu';
import type { WeaponDefinition } from '../../combat/weapon-definitions';
import {
  FLY_DOPPLER_FACTOR,
  FLY_DOPPLER_MAX_PITCH_SHIFT,
  FLY_DOPPLER_PITCH_REFERENCE_SPEED,
  WEAPON_AUDIO_FLY_VOICE_CAP
} from '../audio-config';
import { AudioContextEngine } from '../audio-mixer';
import { isWithinHearingRange, readAudioListenerPosition, setupSpatialPanner } from '../audio-system';
import { getFlybyNoiseBuffer } from './audio-flyby-noise';
import { syncFlybyPanner } from './audio-flyby-panner';
import { deriveFlybyPreset } from './audio-flyby-preset';

const _listenerPosition = new Vector3();
const _velocityScratch = new Vector3();
const _toListener = new Vector3();

interface FlySlotGraph {
  panner: PannerNode;
  input: GainNode;
  filter: BiquadFilterNode;
  humOscillator: OscillatorNode;
  humGain: GainNode;
  noiseSource: AudioBufferSourceNode;
  noiseGain: GainNode;
}

interface FlySlot {
  active: boolean;
  baseHumHz: number;
  graph: FlySlotGraph | null;
}

let shared: AudioFlybyVoice | null = null;

export function getAudioFlybyVoice(): AudioFlybyVoice {
  shared ??= new AudioFlybyVoice();
  return shared;
}

/** Fixed subgraph per slot — sources run continuously, gain mutes when idle. */
export class AudioFlybyVoice {
  readonly #slots: FlySlot[] = Array.from({ length: WEAPON_AUDIO_FLY_VOICE_CAP }, () => ({
    active: false,
    baseHumHz: 168,
    graph: null
  }));

  attach(
    weapon: WeaponDefinition,
    position: Vector3,
    direction: Vector3,
    speed: number,
    impactRadius: number
  ): number | null {
    if (!isWithinHearingRange(position)) {
      return null;
    }

    AudioContextEngine.get().resume();
    this.#ensureGraphs();

    const slotIndex = this.#claimSlot();
    if (slotIndex === null) {
      return null;
    }

    const slot = this.#slots[slotIndex];
    const graph = slot.graph;
    if (graph === null) {
      return null;
    }

    this.#applyPreset(slot, weapon, speed, impactRadius);
    graph.panner.connect(AudioContextEngine.get().sfxInput);
    slot.active = true;
    this.#sync(slot, position, direction, speed);
    return slotIndex;
  }

  /** False when the slot was released — caller must clear flySlot and may re-attach. */
  sync(slotIndex: number, position: Vector3, direction: Vector3, speed: number): boolean {
    const slot = this.#slots[slotIndex];
    if (!slot.active || slot.graph === null) {
      return false;
    }

    if (!isWithinHearingRange(position)) {
      this.detach(slotIndex);
      return false;
    }

    this.#sync(slot, position, direction, speed);
    return true;
  }

  detach(slotIndex: number): void {
    const slot = this.#slots[slotIndex];
    const graph = slot.graph;
    if (!slot.active || graph === null) {
      return;
    }

    graph.humGain.gain.value = 0;
    graph.noiseGain.gain.value = 0;
    try {
      graph.panner.disconnect();
    } catch {
      /* already torn down */
    }
    slot.active = false;
  }

  #ensureGraphs(): void {
    const audio = AudioContextEngine.get();
    const context = audio.context;
    const noiseBuffer = getFlybyNoiseBuffer(context);
    const time = context.currentTime;

    for (const slot of this.#slots) {
      if (slot.graph !== null) {
        continue;
      }

      const panner = context.createPanner();
      setupSpatialPanner(panner);
      panner.positionX.setValueAtTime(0, time);
      panner.positionY.setValueAtTime(0, time);
      panner.positionZ.setValueAtTime(0, time);

      const input = context.createGain();
      input.gain.value = 1;
      input.connect(panner);

      const filter = context.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 800;
      filter.Q.value = 0.85;

      const humOscillator = context.createOscillator();
      humOscillator.type = 'sawtooth';
      humOscillator.frequency.value = 168;

      const humGain = context.createGain();
      humGain.gain.value = 0;
      humOscillator.connect(humGain);
      humGain.connect(input);

      const noiseSource = context.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      const noiseGain = context.createGain();
      noiseGain.gain.value = 0;
      noiseSource.connect(noiseGain);
      noiseGain.connect(filter);
      filter.connect(input);

      humOscillator.start(time);
      noiseSource.start(time);

      slot.graph = {
        panner,
        input,
        filter,
        humOscillator,
        humGain,
        noiseSource,
        noiseGain
      };
    }
  }

  #claimSlot(): number | null {
    for (let index = 0; index < this.#slots.length; index += 1) {
      if (!this.#slots[index].active) {
        return index;
      }
    }

    return null;
  }

  #applyPreset(
    slot: FlySlot,
    weapon: WeaponDefinition,
    speed: number,
    impactRadius: number
  ): void {
    const graph = slot.graph;
    if (graph === null) {
      return;
    }

    const preset = deriveFlybyPreset(weapon, speed, impactRadius);
    slot.baseHumHz = preset.humHz;
    graph.humOscillator.type = preset.toneSquare ? 'square' : 'sawtooth';
    graph.humOscillator.frequency.value = preset.humHz;
    graph.humGain.gain.value = preset.humVolume;
    graph.noiseGain.gain.value = preset.noiseVolume;
    graph.filter.frequency.value = preset.noiseFilterHz;
    graph.filter.Q.value = preset.toneSquare ? 1.4 : 0.85;
  }

  #sync(slot: FlySlot, position: Vector3, direction: Vector3, speed: number): void {
    const graph = slot.graph;
    if (graph === null) {
      return;
    }

    const time = AudioContextEngine.get().context.currentTime;
    _velocityScratch.copy(direction).multiplyScalar(speed * FLY_DOPPLER_FACTOR);
    syncFlybyPanner(graph.panner, position, _velocityScratch);

    const distanceSq = _toListener.copy(readAudioListenerPosition(_listenerPosition)).sub(position).lengthSq();
    if (distanceSq < 0.0001) {
      graph.humOscillator.frequency.setValueAtTime(slot.baseHumHz, time);
      return;
    }

    _toListener.multiplyScalar(1 / Math.sqrt(distanceSq));
    const radialMps = _velocityScratch.dot(_toListener);
    const pitchShift = Math.max(
      -FLY_DOPPLER_MAX_PITCH_SHIFT,
      Math.min(FLY_DOPPLER_MAX_PITCH_SHIFT, radialMps / FLY_DOPPLER_PITCH_REFERENCE_SPEED)
    );
    graph.humOscillator.frequency.setValueAtTime(slot.baseHumHz * (1 + pitchShift), time);
  }
}
