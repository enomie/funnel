import { Vector3 } from 'three/webgpu';
import { REDEEMER_IMPACT_EXPAND_MS } from '../../combat/weapon-definitions';
import { getNoiseBuffer } from '../audio-noise-buffer';
import { AUDIO_VOICE_PEAK } from '../audio-config';
import { AudioContextEngine } from '../audio-mixer';
import { isWithinHearingRange, readAudioListenerPosition, setupSpatialPanner } from '../audio-system';

const REDEEMER_IMPACT_CAP = 3;
const BLAST_ROAR_DURATION_S = REDEEMER_IMPACT_EXPAND_MS / 1000;
const BLAST_SWELL_END_S = BLAST_ROAR_DURATION_S * 0.58;
const BLAST_ATTACK_S = 0.18;
const BLAST_RELEASE_S = 0.72;
const BLAST_SUB_HZ = 36;
const BLAST_BODY_HZ = 74;
const BLAST_NOISE_FILTER_HZ = 260;

const _listenerPosition = new Vector3();

interface RedeemerNodes {
  panner: PannerNode;
  input: GainNode;
  subOsc: OscillatorNode;
  bodyOsc: OscillatorNode;
  noiseSource: AudioBufferSourceNode;
  subGain: GainNode;
  bodyGain: GainNode;
  noiseFilter: BiquadFilterNode;
  noiseGain: GainNode;
}

interface RedeemerSlot {
  active: boolean;
  nodes: RedeemerNodes | null;
}

let shared: AudioRedeemerImpact | null = null;

export function getAudioRedeemerImpact(): AudioRedeemerImpact {
  shared ??= new AudioRedeemerImpact();
  return shared;
}

export class AudioRedeemerImpact {
  readonly #slots: RedeemerSlot[] = Array.from({ length: REDEEMER_IMPACT_CAP }, () => ({
    active: false,
    nodes: null
  }));

  attach(position: Vector3, gainScale: number): number | null {
    if (!isWithinHearingRange(position, 'mapWide')) {
      return null;
    }

    AudioContextEngine.get().resume();
    const slotIndex = this.#claimSlot();
    if (slotIndex === null) {
      return null;
    }

    const slot = this.#slots[slotIndex];
    this.#release(slot);
    slot.nodes = this.#createNodes(position, gainScale, slotIndex);
    slot.active = true;
    return slotIndex;
  }

  detach(slotIndex: number): void {
    const slot = this.#slots[slotIndex];
    this.#release(slot);
    slot.active = false;
  }

  #claimSlot(): number | null {
    for (let index = 0; index < this.#slots.length; index += 1) {
      if (!this.#slots[index].active) {
        return index;
      }
    }

    let farthestIndex = 0;
    let farthestDistanceSq = -1;
    for (let index = 0; index < this.#slots.length; index += 1) {
      const nodes = this.#slots[index].nodes;
      if (nodes === null) {
        return index;
      }

      const distanceSq = distanceSqFromPanner(nodes.panner, readAudioListenerPosition(_listenerPosition));
      if (distanceSq > farthestDistanceSq) {
        farthestDistanceSq = distanceSq;
        farthestIndex = index;
      }
    }

    this.detach(farthestIndex);
    return farthestIndex;
  }

  #createNodes(position: Vector3, gainScale: number, slotIndex: number): RedeemerNodes {
    const audio = AudioContextEngine.get();
    const context = audio.context;
    const time = context.currentTime;
    const endTime = time + BLAST_ROAR_DURATION_S;
    const peakVolume = AUDIO_VOICE_PEAK * gainScale;

    const panner = context.createPanner();
    setupSpatialPanner(panner, 'mapWide');
    panner.positionX.setValueAtTime(position.x, time);
    panner.positionY.setValueAtTime(position.y, time);
    panner.positionZ.setValueAtTime(position.z, time);

    const input = context.createGain();
    input.gain.setValueAtTime(0.001, time);
    input.gain.exponentialRampToValueAtTime(peakVolume * 0.22, time + BLAST_ATTACK_S);
    input.gain.exponentialRampToValueAtTime(peakVolume, time + BLAST_SWELL_END_S);
    input.gain.setValueAtTime(peakVolume * 0.9, endTime - BLAST_RELEASE_S);
    input.gain.exponentialRampToValueAtTime(0.001, endTime);
    input.connect(panner);
    panner.connect(audio.sfxInput);

    const subOsc = context.createOscillator();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(BLAST_SUB_HZ, time);
    subOsc.frequency.exponentialRampToValueAtTime(BLAST_SUB_HZ * 0.62, endTime);

    const bodyOsc = context.createOscillator();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(BLAST_BODY_HZ, time);
    bodyOsc.frequency.exponentialRampToValueAtTime(BLAST_BODY_HZ * 0.55, endTime);

    const subGain = context.createGain();
    subGain.gain.value = 0.52;
    const bodyGain = context.createGain();
    bodyGain.gain.value = 0.34;

    const noiseSource = context.createBufferSource();
    noiseSource.buffer = getNoiseBuffer(context, 'redeemer-blast');
    noiseSource.loop = true;

    const noiseFilter = context.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = BLAST_NOISE_FILTER_HZ;
    noiseFilter.Q.value = 0.58;

    const noiseGain = context.createGain();
    noiseGain.gain.value = 0.42;

    subOsc.connect(subGain);
    bodyOsc.connect(bodyGain);
    subGain.connect(input);
    bodyGain.connect(input);
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(input);

    subOsc.start(time);
    bodyOsc.start(time);
    noiseSource.start(time);
    subOsc.stop(endTime);
    bodyOsc.stop(endTime);
    noiseSource.stop(endTime);
    subOsc.onended = () => {
      this.#finalizeSlot(slotIndex);
    };

    return {
      panner,
      input,
      subOsc,
      bodyOsc,
      noiseSource,
      subGain,
      bodyGain,
      noiseFilter,
      noiseGain
    };
  }

  #finalizeSlot(slotIndex: number): void {
    const slot = this.#slots[slotIndex];
    if (!slot.active) {
      return;
    }
    this.#release(slot);
    slot.active = false;
  }

  #release(slot: RedeemerSlot): void {
    const nodes = slot.nodes;
    if (nodes === null) {
      return;
    }

    nodes.subOsc.onended = null;
    const stopTime = AudioContextEngine.get().context.currentTime + 0.02;
    stopNode(nodes.subOsc, stopTime);
    stopNode(nodes.bodyOsc, stopTime);
    stopNode(nodes.noiseSource, stopTime);
    nodes.subOsc.disconnect();
    nodes.subGain.disconnect();
    nodes.bodyOsc.disconnect();
    nodes.bodyGain.disconnect();
    nodes.noiseSource.disconnect();
    nodes.noiseFilter.disconnect();
    nodes.noiseGain.disconnect();
    nodes.input.disconnect();
    nodes.panner.disconnect();
    slot.nodes = null;
  }
}

function stopNode(node: OscillatorNode | AudioBufferSourceNode, stopTime: number): void {
  try {
    node.stop(stopTime);
  } catch {
    /* already stopped */
  }
}

function distanceSqFromPanner(panner: PannerNode, listener: Vector3): number {
  const dx = panner.positionX.value - listener.x;
  const dy = panner.positionY.value - listener.y;
  const dz = panner.positionZ.value - listener.z;
  return dx * dx + dy * dy + dz * dz;
}
