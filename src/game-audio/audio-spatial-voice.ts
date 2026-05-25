// Path: /Users/johann/MyBrew/funnel-real/src/game-audio/audio-spatial-voice.ts

import type { Vector3 } from 'three/webgpu';
import {
  FOOTSTEP_VOICE_CAP,
  SPATIAL_ONE_SHOT_EVICT_RANK,
  SPATIAL_ONE_SHOT_TTL_S,
  SPATIAL_ONE_SHOT_VOICE_CAP,
  type SpatialOneShotKind
} from './audio-config';
import {
  isAudioAlive,
  registerAudioSilenceHook,
  safeConnect,
  safeCreateNode,
  safeDisconnect,
  safeStop
} from './audio-guard';
import { AudioContextEngine } from './audio-mixer';
import { isWithinHearingRange, setupSpatialPanner, type SpatialAudioRange } from './audio-system';
import { syncPannerPositionImmediate } from './audio-spatial-sync';

export type AudioOneShotAnchor = AudioScheduledSourceNode | OscillatorNode;

export interface AudioOneShotVoice {
  readonly input: GainNode;
  readonly handle: number;
  track: (...nodes: AudioNode[]) => void;
  endAfter: (anchor: AudioOneShotAnchor, onRelease?: () => void) => void;
}

export type OneShotKind = SpatialOneShotKind;

export interface SustainedSpatialVoice {
  readonly input: GainNode;
  readonly handle: number;
  syncPosition(position: Vector3): void;
  track: (...nodes: AudioNode[]) => void;
  release(): void;
  onAutoRelease(callback: () => void): void;
}

interface OneShotLease {
  panner: PannerNode;
  input: GainNode;
  kind: OneShotKind;
  trackedNodes: AudioNode[];
  released: boolean;
  releaseAt: number;
  handle: number;
  onRelease?: () => void;
}

const active: OneShotLease[] = [];
const pool: OneShotLease[] = [];
const leaseHandles = new Map<number, OneShotLease>();
let nextLeaseHandle = 1;

const REDEEMER_BLAST_VOICE_CAP = 3;
const MECHANICS_HOLD_VOICE_CAP = 3;

export function releaseSpatialOneShotHandle(handle: number): void {
  const lease = leaseHandles.get(handle);
  if (lease !== undefined && !lease.released) {
    releaseLease(lease);
  }
}

registerAudioSilenceHook(emergencySilenceSpatialOneShots);

export function emergencySilenceSpatialOneShots(): void {
  for (let index = active.length - 1; index >= 0; index -= 1) {
    releaseLease(active[index]);
  }
}

export function tryBeginSpatialOneShot(
  position: Vector3,
  kind: OneShotKind = 'generic',
  range?: SpatialAudioRange
): AudioOneShotVoice | null {
  if (!isAudioAlive()) {
    return null;
  }

  sweepExpiredSpatialOneShots();

  const hearingRange = range ?? defaultSpatialRange(kind);
  if (!isWithinHearingRange(position, hearingRange)) {
    return null;
  }

  if (active.length >= SPATIAL_ONE_SHOT_VOICE_CAP) {
    makeRoomForLease();
  }

  if (kind === 'foot' && activeFootstepCount() >= FOOTSTEP_VOICE_CAP) {
    return null;
  }

  if (kind === 'redeemer-blast') {
    evictRedeemerBlastIfAtCap();
  }

  if (kind === 'mechanics-hold') {
    evictMechanicsHoldIfAtCap();
  }

  const lease = acquireLease(position, hearingRange);
  if (lease === null) {
    return null;
  }

  lease.kind = kind;
  lease.trackedNodes.length = 0;
  lease.released = false;
  lease.releaseAt = Number.POSITIVE_INFINITY;
  lease.onRelease = undefined;
  lease.handle = assignLeaseHandle(lease);
  wireMixBus(lease);
  active.push(lease);
  return wrapLease(lease);
}

export function tryBeginSustainedSpatialVoice(
  position: Vector3,
  kind: OneShotKind = 'mechanics-hold',
  range?: SpatialAudioRange,
  ttlOverrideS?: number
): SustainedSpatialVoice | null {
  const voice = tryBeginSpatialOneShot(position, kind, range);
  if (voice === null) {
    return null;
  }

  const lease = leaseHandles.get(voice.handle);
  if (lease === undefined) {
    releaseSpatialOneShotHandle(voice.handle);
    return null;
  }

  const context = AudioContextEngine.get().context;
  lease.releaseAt = context.currentTime + (ttlOverrideS ?? SPATIAL_ONE_SHOT_TTL_S[kind]);

  return {
    input: voice.input,
    handle: voice.handle,
    syncPosition: (syncPosition) => {
      syncPannerPositionImmediate(lease.panner, syncPosition);
    },
    track: (...nodes) => {
      voice.track(...nodes);
    },
    release: () => {
      releaseSpatialOneShotHandle(voice.handle);
    },
    onAutoRelease: (callback) => {
      lease.onRelease = callback;
    }
  };
}

function assignLeaseHandle(lease: OneShotLease): number {
  const handle = nextLeaseHandle;
  nextLeaseHandle = (nextLeaseHandle + 1) | 0 || 1;
  leaseHandles.set(handle, lease);
  return handle;
}

function activeRedeemerBlastCount(): number {
  let count = 0;
  for (const lease of active) {
    if (lease.kind === 'redeemer-blast') {
      count += 1;
    }
  }
  return count;
}

function activeMechanicsHoldCount(): number {
  let count = 0;
  for (const lease of active) {
    if (lease.kind === 'mechanics-hold') {
      count += 1;
    }
  }
  return count;
}

function evictMechanicsHoldIfAtCap(): void {
  if (activeMechanicsHoldCount() < MECHANICS_HOLD_VOICE_CAP) {
    return;
  }

  let victimIndex = -1;
  let earliestReleaseAt = Number.POSITIVE_INFINITY;
  for (let index = 0; index < active.length; index += 1) {
    const lease = active[index];
    if (lease.kind !== 'mechanics-hold') {
      continue;
    }
    if (lease.releaseAt < earliestReleaseAt) {
      earliestReleaseAt = lease.releaseAt;
      victimIndex = index;
    }
  }

  if (victimIndex >= 0) {
    releaseLease(active[victimIndex]);
  }
}

function evictRedeemerBlastIfAtCap(): void {
  if (activeRedeemerBlastCount() < REDEEMER_BLAST_VOICE_CAP) {
    return;
  }

  let victimIndex = -1;
  let earliestReleaseAt = Number.POSITIVE_INFINITY;
  for (let index = 0; index < active.length; index += 1) {
    const lease = active[index];
    if (lease.kind !== 'redeemer-blast') {
      continue;
    }
    if (lease.releaseAt < earliestReleaseAt) {
      earliestReleaseAt = lease.releaseAt;
      victimIndex = index;
    }
  }

  if (victimIndex >= 0) {
    releaseLease(active[victimIndex]);
  }
}

function activeFootstepCount(): number {
  let count = 0;
  for (const lease of active) {
    if (lease.kind === 'foot') {
      count += 1;
    }
  }
  return count;
}

function defaultSpatialRange(kind: OneShotKind): SpatialAudioRange {
  if (kind === 'redeemer-blast') {
    return 'mapWide';
  }

  return kind === 'foot' || kind === 'grunt' || kind === 'mechanics' || kind === 'mechanics-hold'
    ? 'near'
    : 'combat';
}

function acquireLease(position: Vector3, range: SpatialAudioRange): OneShotLease | null {
  for (const lease of pool) {
    if (lease.released) {
      setupSpatialPanner(lease.panner, range);
      syncPanner(lease.panner, position);
      return lease;
    }
  }

  if (pool.length >= SPATIAL_ONE_SHOT_VOICE_CAP) {
    return null;
  }

  const context = AudioContextEngine.get().context;
  const panner = safeCreateNode('one-shot-panner', () => context.createPanner());
  if (panner === null) {
    return null;
  }

  setupSpatialPanner(panner, range);
  syncPanner(panner, position);

  const input = safeCreateNode('one-shot-input', () => context.createGain());
  if (input === null) {
    return null;
  }

  input.gain.value = 1;
  if (!safeConnect(input, panner, 'one-shot-input-panner')) {
    return null;
  }

  const lease: OneShotLease = {
    panner,
    input,
    kind: 'generic',
    trackedNodes: [],
    released: false,
    releaseAt: Number.POSITIVE_INFINITY,
    handle: 0
  };
  pool.push(lease);
  return lease;
}

function wireMixBus(lease: OneShotLease): void {
  safeDisconnect(lease.panner, 'one-shot-wire-disconnect');
  safeConnect(lease.panner, AudioContextEngine.get().sfxInput, 'one-shot-panner-bus');
}

function syncPanner(panner: PannerNode, position: Vector3): void {
  syncPannerPositionImmediate(panner, position);
}

function wrapLease(lease: OneShotLease): AudioOneShotVoice {
  return {
    input: lease.input,
    handle: lease.handle,
    track: (...nodes) => {
      lease.trackedNodes.push(...nodes);
    },
    endAfter: (anchor, onRelease) => {
      lease.onRelease = onRelease;
      const context = AudioContextEngine.get().context;
      lease.releaseAt = context.currentTime + SPATIAL_ONE_SHOT_TTL_S[lease.kind];
      anchor.onended = () => {
        releaseLease(lease);
      };
    }
  };
}

export function sweepExpiredSpatialOneShots(): void {
  const now = AudioContextEngine.get().context.currentTime;
  for (let index = active.length - 1; index >= 0; index -= 1) {
    const lease = active[index];
    if (lease.releaseAt <= now) {
      releaseLease(lease);
    }
  }
}

function makeRoomForLease(): void {
  sweepExpiredSpatialOneShots();
  if (active.length < SPATIAL_ONE_SHOT_VOICE_CAP) {
    return;
  }

  let victimIndex = 0;
  let victimRank = SPATIAL_ONE_SHOT_EVICT_RANK[active[0].kind];
  let victimReleaseAt = active[0].releaseAt;

  for (let index = 1; index < active.length; index += 1) {
    const lease = active[index];
    const rank = SPATIAL_ONE_SHOT_EVICT_RANK[lease.kind];
    if (rank < victimRank || (rank === victimRank && lease.releaseAt < victimReleaseAt)) {
      victimIndex = index;
      victimRank = rank;
      victimReleaseAt = lease.releaseAt;
    }
  }

  releaseLease(active[victimIndex]);
}

function releaseLease(lease: OneShotLease): void {
  if (lease.released) {
    return;
  }

  lease.released = true;
  lease.releaseAt = Number.POSITIVE_INFINITY;

  for (const node of lease.trackedNodes) {
    stopAndDisconnect(node);
  }
  lease.trackedNodes.length = 0;

  const index = active.indexOf(lease);
  if (index >= 0) {
    active[index] = active[active.length - 1];
    active.length -= 1;
  }

  lease.onRelease?.();
  lease.onRelease = undefined;

  leaseHandles.delete(lease.handle);
  safeDisconnect(lease.panner, 'one-shot-release-disconnect');
}

function stopAndDisconnect(node: AudioNode): void {
  if (isScheduledSource(node)) {
    const stopTime = AudioContextEngine.get().context.currentTime;
    safeStop(node, stopTime, 'one-shot-stop');
  }

  safeDisconnect(node, 'one-shot-node-disconnect');
}

function isScheduledSource(node: AudioNode): node is AudioScheduledSourceNode {
  return 'stop' in node && typeof node.stop === 'function';
}
