import type { Vector3 } from 'three/webgpu';
import { getNoiseBuffer } from '../audio-noise-buffer';
import { AUDIO_VOICE_PEAK } from '../audio-config';
import { AudioContextEngine } from '../audio-mixer';
import { isWithinHearingRange, setupSpatialPanner } from '../audio-system';
import { playNoiseBurst, playOscBurst, playSweepOscBurst } from '../audio-one-shots/audio-one-shot-synth';

export type ReloadMechanicsKind = 'none' | 'chamber' | 'magazine';

export interface ReloadMechanicsState {
  readonly startedAtMs: number;
  readonly durationMs: number;
  readonly kind: ReloadMechanicsKind;
}

const RELOAD_GAIN = 0.5;

const RELOAD_VALVE_START_HZ = 520;
const RELOAD_VALVE_END_HZ = 280;
const RELOAD_SEAT_HZ = 480;
const RELOAD_LOCK_START_HZ = 420;
const RELOAD_LOCK_END_HZ = 220;
const RELOAD_TICK_HZ = 680;
const RELOAD_STEAM_RUMBLE_BASE_HZ = 52;
const RELOAD_STEAM_RUMBLE_PEAK_HZ = 88;

const RELOAD_CLICK_GAIN = AUDIO_VOICE_PEAK * RELOAD_GAIN;
const RELOAD_NOISE_GAIN = AUDIO_VOICE_PEAK * 0.72 * RELOAD_GAIN;
const RELOAD_TICK_GAIN = AUDIO_VOICE_PEAK * 0.52 * RELOAD_GAIN;
const RELOAD_LOCK_GAIN = AUDIO_VOICE_PEAK * 1.12 * RELOAD_GAIN;
const RELOAD_STEAM_BED_GAIN = AUDIO_VOICE_PEAK * 0.22 * RELOAD_GAIN;
const RELOAD_RUMBLE_GAIN = AUDIO_VOICE_PEAK * 0.14 * RELOAD_GAIN;

interface ReloadTiming {
  valveReleaseS: number;
  steamHissS: number;
  seatS: number;
  lockS: number;
  tickS: number;
  lockLeadS: number;
  seatFraction: number;
  tickIntervalS: number;
}

interface ReloadVoiceNodes {
  panner: PannerNode;
  extraNodes: AudioNode[];
  anchor: AudioScheduledSourceNode | OscillatorNode;
}

const _reloadTimingScratch: ReloadTiming = {
  valveReleaseS: 0,
  steamHissS: 0,
  seatS: 0,
  lockS: 0,
  tickS: 0,
  lockLeadS: 0,
  seatFraction: 0,
  tickIntervalS: 0
};

function fillReloadTimingForDuration(
  durationS: number,
  out: ReloadTiming = _reloadTimingScratch
): ReloadTiming {
  out.valveReleaseS = Math.max(0.08, Math.min(0.42, 0.05 + durationS * 0.009));
  out.steamHissS = Math.max(0.18, Math.min(1.4, durationS * 0.038));
  out.seatS = Math.max(0.1, Math.min(0.52, durationS * 0.013));
  out.lockS = Math.max(0.1, Math.min(0.62, durationS * 0.016));
  out.tickS = Math.max(0.06, Math.min(0.22, durationS * 0.0055));
  out.lockLeadS = Math.max(0.1, Math.min(2.8, durationS * 0.085));
  out.seatFraction = durationS > 8 ? 0.74 : 0.6;
  out.tickIntervalS = Math.max(0.45, Math.min(4.5, durationS / 7.2));
  return out;
}

/** Weapon reload at muzzle — 20 m; steampunk valve/clockwork bed scaled to reload duration. */
export class WeaponReloadAudio {
  #trackedReloadStartMs = 0;
  #active: ReloadVoiceNodes | null = null;

  stop(): void {
    this.#stop();
    this.#trackedReloadStartMs = 0;
  }

  isActive(): boolean {
    return this.#active !== null;
  }

  sync(position: Vector3, state: ReloadMechanicsState, nowMs: number): void {
    const reloadActive =
      state.kind !== 'none' &&
      state.startedAtMs > 0 &&
      state.durationMs > 0 &&
      nowMs < state.startedAtMs + state.durationMs;

    if (reloadActive && state.startedAtMs !== this.#trackedReloadStartMs) {
      this.#stop();
      this.#start(position, state.durationMs);
      this.#trackedReloadStartMs = state.startedAtMs;
    } else if (!reloadActive) {
      if (this.#active !== null || this.#trackedReloadStartMs > 0) {
        this.#stop();
        this.#trackedReloadStartMs = 0;
      }
      return;
    }

    const nodes = this.#active;
    if (nodes !== null) {
      nodes.panner.positionX.value = position.x;
      nodes.panner.positionY.value = position.y;
      nodes.panner.positionZ.value = position.z;
    }
  }

  #start(position: Vector3, durationMs: number): void {
    if (!isWithinHearingRange(position, 'near')) {
      return;
    }

    const durationS = durationMs / 1000;
    const timing = fillReloadTimingForDuration(durationS);
    const audio = AudioContextEngine.get();
    audio.resume();
    const context = audio.context;
    const time = context.currentTime;
    const endTime = time + durationS;
    const extraNodes: AudioNode[] = [];

    const panner = context.createPanner();
    setupSpatialPanner(panner, 'near');
    panner.positionX.setValueAtTime(position.x, time);
    panner.positionY.setValueAtTime(position.y, time);
    panner.positionZ.setValueAtTime(position.z, time);
    panner.connect(audio.sfxInput);

    const bedAnchor = this.#playSteamBed(context, panner, time, endTime, durationS, extraNodes);
    this.#playValveRelease(context, panner, time, timing, extraNodes);
    this.#scheduleClockworkTicks(context, panner, time, endTime, durationS, timing, extraNodes);

    const seatTime = time + durationS * timing.seatFraction;
    const lockTime = Math.max(time + 0.06, endTime - timing.lockLeadS);
    this.#playChamberSeat(context, panner, Math.min(seatTime, lockTime - 0.04), timing, extraNodes);
    this.#playPressureLock(context, panner, lockTime, timing, extraNodes);

    bedAnchor.onended = () => {
      this.#stop();
      this.#trackedReloadStartMs = 0;
    };

    this.#active = { panner, extraNodes, anchor: bedAnchor };
  }

  #playSteamBed(
    context: AudioContext,
    panner: PannerNode,
    time: number,
    endTime: number,
    durationS: number,
    extraNodes: AudioNode[]
  ): OscillatorNode {
    const attackS = Math.min(1.8, durationS * 0.08);
    const releaseS = Math.min(1.2, durationS * 0.05);
    const holdEnd = endTime - releaseS;

    const bedGain = context.createGain();
    bedGain.gain.setValueAtTime(0.001, time);
    bedGain.gain.exponentialRampToValueAtTime(Math.max(0.001, RELOAD_STEAM_BED_GAIN), time + attackS);
    bedGain.gain.setValueAtTime(RELOAD_STEAM_BED_GAIN, holdEnd);
    bedGain.gain.exponentialRampToValueAtTime(0.001, endTime);
    bedGain.connect(panner);
    extraNodes.push(bedGain);

    const rumbleOsc = context.createOscillator();
    rumbleOsc.type = 'sine';
    rumbleOsc.frequency.setValueAtTime(RELOAD_STEAM_RUMBLE_BASE_HZ, time);
    rumbleOsc.frequency.linearRampToValueAtTime(RELOAD_STEAM_RUMBLE_PEAK_HZ, time + durationS * 0.72);

    const rumbleGain = context.createGain();
    rumbleGain.gain.value = RELOAD_RUMBLE_GAIN;
    rumbleOsc.connect(rumbleGain);
    rumbleGain.connect(bedGain);
    extraNodes.push(rumbleOsc, rumbleGain);

    const hissSource = context.createBufferSource();
    hissSource.buffer = getNoiseBuffer(context, 'bio-rumble');
    hissSource.loop = true;

    const hissFilter = context.createBiquadFilter();
    hissFilter.type = 'bandpass';
    hissFilter.frequency.setValueAtTime(420, time);
    hissFilter.frequency.linearRampToValueAtTime(760, time + durationS * 0.65);
    hissFilter.Q.value = 0.62;

    const hissGain = context.createGain();
    hissGain.gain.value = 0.58;
    hissSource.connect(hissFilter);
    hissFilter.connect(hissGain);
    hissGain.connect(bedGain);
    extraNodes.push(hissSource, hissFilter, hissGain);

    rumbleOsc.start(time);
    rumbleOsc.stop(endTime + 0.02);
    hissSource.start(time);
    hissSource.stop(endTime + 0.02);

    return rumbleOsc;
  }

  #playValveRelease(
    context: AudioContext,
    panner: PannerNode,
    time: number,
    timing: ReloadTiming,
    extraNodes: AudioNode[]
  ): void {
    playSweepOscBurst({
      context,
      destination: panner,
      time,
      startHz: RELOAD_VALVE_START_HZ,
      endHz: RELOAD_VALVE_END_HZ,
      durationS: timing.valveReleaseS,
      volume: RELOAD_CLICK_GAIN,
      type: 'sawtooth',
      lowpassStartHz: 980,
      lowpassEndHz: 420,
      track: (...nodes) => {
        extraNodes.push(...nodes);
      }
    });

    playNoiseBurst({
      context,
      destination: panner,
      time: time + 0.02,
      durationS: timing.steamHissS,
      volume: RELOAD_NOISE_GAIN,
      noiseKey: 'rocket-fireball',
      filterHz: 620,
      filterQ: 0.55,
      attackS: Math.min(0.12, timing.steamHissS * 0.18),
      track: (...nodes) => {
        extraNodes.push(...nodes);
      }
    });
  }

  #playChamberSeat(
    context: AudioContext,
    panner: PannerNode,
    time: number,
    timing: ReloadTiming,
    extraNodes: AudioNode[]
  ): void {
    playOscBurst({
      context,
      destination: panner,
      time,
      frequency: RELOAD_SEAT_HZ,
      durationS: timing.seatS,
      volume: RELOAD_CLICK_GAIN * 0.92,
      type: 'triangle',
      track: (...nodes) => {
        extraNodes.push(...nodes);
      }
    });

    playNoiseBurst({
      context,
      destination: panner,
      time: time + 0.012,
      durationS: timing.seatS * 1.05,
      volume: RELOAD_NOISE_GAIN * 0.78,
      noiseKey: 'empty-click',
      filterHz: 1180,
      filterQ: 0.72,
      track: (...nodes) => {
        extraNodes.push(...nodes);
      }
    });
  }

  #playPressureLock(
    context: AudioContext,
    panner: PannerNode,
    time: number,
    timing: ReloadTiming,
    extraNodes: AudioNode[]
  ): void {
    playSweepOscBurst({
      context,
      destination: panner,
      time,
      startHz: RELOAD_LOCK_START_HZ,
      endHz: RELOAD_LOCK_END_HZ,
      durationS: timing.lockS,
      volume: RELOAD_LOCK_GAIN,
      type: 'square',
      lowpassStartHz: 860,
      lowpassEndHz: 320,
      track: (...nodes) => {
        extraNodes.push(...nodes);
      }
    });

    playNoiseBurst({
      context,
      destination: panner,
      time: time + 0.018,
      durationS: timing.lockS * 1.15,
      volume: RELOAD_NOISE_GAIN * 0.64,
      noiseKey: 'foot-scrape',
      filterHz: 920,
      filterQ: 0.68,
      track: (...nodes) => {
        extraNodes.push(...nodes);
      }
    });
  }

  #scheduleClockworkTicks(
    context: AudioContext,
    panner: PannerNode,
    startTime: number,
    endTime: number,
    durationS: number,
    timing: ReloadTiming,
    extraNodes: AudioNode[]
  ): void {
    const lockTime = Math.max(startTime + 0.06, endTime - timing.lockLeadS);
    const seatTime = startTime + durationS * timing.seatFraction;
    let tickTime = startTime + timing.tickIntervalS;
    let tickIndex = 0;

    while (tickTime < lockTime - 0.04 && tickTime < seatTime - 0.08) {
      const wobbleHz = RELOAD_TICK_HZ - tickIndex * 18;
      playOscBurst({
        context,
        destination: panner,
        time: tickTime,
        frequency: wobbleHz,
        durationS: timing.tickS,
        volume: RELOAD_TICK_GAIN,
        type: 'triangle',
        track: (...nodes) => {
          extraNodes.push(...nodes);
        }
      });

      if (tickIndex % 2 === 0) {
        playNoiseBurst({
          context,
          destination: panner,
          time: tickTime + 0.008,
          durationS: timing.tickS * 1.2,
          volume: RELOAD_TICK_GAIN * 0.55,
          noiseKey: 'empty-click',
          filterHz: 980,
          filterQ: 0.8,
          track: (...nodes) => {
            extraNodes.push(...nodes);
          }
        });
      }

      tickTime += timing.tickIntervalS;
      tickIndex += 1;
    }
  }

  #stop(): void {
    const nodes = this.#active;
    if (nodes === null) {
      return;
    }

    nodes.anchor.onended = null;
    const stopTime = AudioContextEngine.get().context.currentTime + 0.02;

    for (const node of nodes.extraNodes) {
      this.#stopSourceIfScheduled(node, stopTime);
      try {
        node.disconnect();
      } catch {
        /* already torn down */
      }
    }

    nodes.panner.disconnect();
    this.#active = null;
  }

  #stopSourceIfScheduled(node: AudioNode, stopTime: number): void {
    if ('stop' in node && typeof node.stop === 'function') {
      try {
        (node as OscillatorNode | AudioBufferSourceNode).stop(stopTime);
      } catch {
        /* already stopped */
      }
    }
  }
}
