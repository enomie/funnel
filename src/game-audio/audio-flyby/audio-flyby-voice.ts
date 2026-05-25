// Path: /Users/johann/MyBrew/funnel-real/src/game-audio/audio-flyby/audio-flyby-voice.ts

import { Vector3 } from 'three/webgpu';
import type { WeaponDefinition } from '../../combat/weapon-definitions';
import {
  FLY_DOPPLER_FACTOR,
  FLY_DOPPLER_MAX_PITCH_SHIFT,
  FLY_DOPPLER_PITCH_REFERENCE_SPEED,
  WEAPON_AUDIO_FLY_VOICE_CAP
} from '../audio-config';
import {
  isAudioAlive,
  registerAudioSilenceHook,
  safeConnect,
  safeCreateNode,
  safeDisconnect,
  safeStart,
  safeStop
} from '../audio-guard';
import { AudioContextEngine } from '../audio-mixer';
import { isWithinHearingRange, readAudioListenerPosition, setupSpatialPanner } from '../audio-system';
import { setAudioParamImmediate, syncPannerPositionImmediate } from '../audio-spatial-sync';
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

export function warmFlybyVoicePool(): void {
  getAudioFlybyVoice().warmPool();
}

export function cleanupFlybyVoices(): void {
  getAudioFlybyVoice().cleanupIdleGraphs();
}


export class AudioFlybyVoice {
  readonly #slots: FlySlot[] = Array.from({ length: WEAPON_AUDIO_FLY_VOICE_CAP }, () => ({
    active: false,
    baseHumHz: 168,
    graph: null
  }));

  constructor() {
    registerAudioSilenceHook(() => {
      this.emergencySilence();
    });
  }

  warmPool(): void {
    if (!isAudioAlive()) {
      return;
    }

    AudioContextEngine.get().resume();
  }

  cleanupIdleGraphs(): void {
    for (let index = 0; index < this.#slots.length; index += 1) {
      const slot = this.#slots[index];
      if (!slot.active && slot.graph !== null) {
        this.#destroyGraph(slot.graph);
        slot.graph = null;
      }
    }
  }

  hasFreeSlot(): boolean {
    for (const slot of this.#slots) {
      if (!slot.active) {
        return true;
      }
    }

    return false;
  }

  emergencySilence(): void {
    for (let index = 0; index < this.#slots.length; index += 1) {
      this.detach(index);
    }
  }

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

    if (!isAudioAlive()) {
      return null;
    }

    AudioContextEngine.get().resume();

    const slotIndex = this.#claimSlot();
    if (slotIndex === null) {
      return null;
    }

    const slot = this.#slots[slotIndex];
    if (slot.graph !== null) {
      this.#destroyGraph(slot.graph);
      slot.graph = null;
    }

    const graph = this.#createGraph();
    if (graph === null) {
      return null;
    }

    slot.graph = graph;

    this.#applyPreset(slot, weapon, speed, impactRadius);
    if (!this.#startGraph(graph)) {
      this.#destroyGraph(graph);
      slot.graph = null;
      return null;
    }

    slot.active = true;
    this.#sync(slot, position, direction, speed);
    return slotIndex;
  }

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
    if (!slot.active && slot.graph === null) {
      return;
    }

    const graph = slot.graph;
    if (graph !== null) {
      this.#destroyGraph(graph);
      slot.graph = null;
    }

    slot.active = false;
  }

  #createGraph(): FlySlotGraph | null {
    const audio = AudioContextEngine.get();
    const context = audio.context;
    const noiseBuffer = getFlybyNoiseBuffer(context);

    const panner = safeCreateNode('flyby-panner', () => context.createPanner());
    if (panner === null) {
      return null;
    }

    setupSpatialPanner(panner);
    syncPannerPositionImmediate(panner, _listenerPosition);

    const input = safeCreateNode('flyby-input', () => context.createGain());
    if (input === null) {
      return null;
    }

    input.gain.value = 1;
    if (!safeConnect(input, panner, 'flyby-input-panner')) {
      return null;
    }

    const filter = safeCreateNode('flyby-filter', () => context.createBiquadFilter());
    if (filter === null) {
      return null;
    }

    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 0.85;

    const humOscillator = safeCreateNode('flyby-hum-osc', () => context.createOscillator());
    if (humOscillator === null) {
      return null;
    }

    humOscillator.type = 'sawtooth';
    humOscillator.frequency.value = 168;

    const humGain = safeCreateNode('flyby-hum-gain', () => context.createGain());
    if (humGain === null) {
      return null;
    }

    humGain.gain.value = 0;
    if (
      !safeConnect(humOscillator, humGain, 'flyby-hum-osc-gain') ||
      !safeConnect(humGain, input, 'flyby-hum-gain-input')
    ) {
      return null;
    }

    const noiseSource = safeCreateNode('flyby-noise-src', () => context.createBufferSource());
    if (noiseSource === null) {
      return null;
    }

    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const noiseGain = safeCreateNode('flyby-noise-gain', () => context.createGain());
    if (noiseGain === null) {
      return null;
    }

    noiseGain.gain.value = 0;
    if (
      !safeConnect(noiseSource, noiseGain, 'flyby-noise-src-gain') ||
      !safeConnect(noiseGain, filter, 'flyby-noise-gain-filter') ||
      !safeConnect(filter, input, 'flyby-filter-input')
    ) {
      return null;
    }

    return {
      panner,
      input,
      filter,
      humOscillator,
      humGain,
      noiseSource,
      noiseGain
    };
  }

  #startGraph(graph: FlySlotGraph): boolean {
    const time = AudioContextEngine.get().context.currentTime;
    if (!safeStart(graph.humOscillator, time, 'flyby-hum-start')) {
      return false;
    }

    if (!safeStart(graph.noiseSource, time, 'flyby-noise-start')) {
      safeStop(graph.humOscillator, time + 0.01, 'flyby-hum-rollback');
      return false;
    }

    return this.#wireGraphToMix(graph);
  }

  #destroyGraph(graph: FlySlotGraph): void {
    const stopTime = AudioContextEngine.get().context.currentTime + 0.02;
    safeStop(graph.humOscillator, stopTime, 'flyby-hum-stop');
    safeStop(graph.noiseSource, stopTime, 'flyby-noise-stop');

    safeDisconnect(graph.humOscillator, 'flyby-humOsc');
    safeDisconnect(graph.humGain, 'flyby-humGain');
    safeDisconnect(graph.noiseSource, 'flyby-noiseSource');
    safeDisconnect(graph.noiseGain, 'flyby-noiseGain');
    safeDisconnect(graph.filter, 'flyby-filter');
    safeDisconnect(graph.input, 'flyby-input');
    safeDisconnect(graph.panner, 'flyby-panner');
  }

  #wireGraphToMix(graph: FlySlotGraph): boolean {
    safeDisconnect(graph.panner, 'flyby-wire-disconnect');
    return safeConnect(graph.panner, AudioContextEngine.get().sfxInput, 'flyby-panner-bus');
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

    _velocityScratch.copy(direction).multiplyScalar(speed * FLY_DOPPLER_FACTOR);
    syncFlybyPanner(graph.panner, position, _velocityScratch);

    const distanceSq = _toListener.copy(readAudioListenerPosition(_listenerPosition)).sub(position).lengthSq();
    let targetHz = slot.baseHumHz;
    if (distanceSq >= 0.0001) {
      const radialMps = _velocityScratch.dot(_toListener.multiplyScalar(1 / Math.sqrt(distanceSq)));
      const pitchShift = Math.max(
        -FLY_DOPPLER_MAX_PITCH_SHIFT,
        Math.min(FLY_DOPPLER_MAX_PITCH_SHIFT, radialMps / FLY_DOPPLER_PITCH_REFERENCE_SPEED)
      );
      targetHz = slot.baseHumHz * (1 + pitchShift);
    }

    setAudioParamImmediate(graph.humOscillator.frequency, targetHz);
  }
}
