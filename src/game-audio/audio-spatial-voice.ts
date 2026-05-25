import type { Vector3 } from 'three/webgpu';
import {
  FOOTSTEP_VOICE_CAP,
  SPATIAL_ONE_SHOT_EVICT_RANK,
  SPATIAL_ONE_SHOT_TTL_S,
  SPATIAL_ONE_SHOT_VOICE_CAP,
  type SpatialOneShotKind
} from './audio-config';
import { AudioContextEngine } from './audio-mixer';
import { isWithinHearingRange, setupSpatialPanner, type SpatialAudioRange } from './audio-system';

export type AudioOneShotAnchor = AudioScheduledSourceNode | OscillatorNode;

export interface AudioOneShotVoice {
  readonly input: GainNode;
  track: (...nodes: AudioNode[]) => void;
  endAfter: (anchor: AudioOneShotAnchor, onRelease?: () => void) => void;
}

export type OneShotKind = SpatialOneShotKind;

interface OneShotLease {
  panner: PannerNode;
  input: GainNode;
  kind: OneShotKind;
  trackedNodes: AudioNode[];
  released: boolean;
  releaseAt: number;
  onRelease?: () => void;
}

const active: OneShotLease[] = [];
const pool: OneShotLease[] = [];

export function tryBeginSpatialOneShot(
  position: Vector3,
  kind: OneShotKind = 'generic',
  range?: SpatialAudioRange
): AudioOneShotVoice | null {
  sweepExpiredLeases();

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

  const lease = acquireLease(position, hearingRange);
  if (lease === null) {
    return null;
  }

  lease.kind = kind;
  lease.trackedNodes.length = 0;
  lease.released = false;
  lease.releaseAt = Number.POSITIVE_INFINITY;
  lease.onRelease = undefined;
  wireMixBus(lease);
  active.push(lease);
  return wrapLease(lease);
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
  return kind === 'foot' || kind === 'grunt' || kind === 'mechanics' ? 'near' : 'combat';
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
  const panner = context.createPanner();
  setupSpatialPanner(panner, range);
  syncPanner(panner, position);

  const input = context.createGain();
  input.gain.value = 1;
  input.connect(panner);

  const lease: OneShotLease = {
    panner,
    input,
    kind: 'generic',
    trackedNodes: [],
    released: false,
    releaseAt: Number.POSITIVE_INFINITY
  };
  pool.push(lease);
  return lease;
}

function wireMixBus(lease: OneShotLease): void {
  try {
    lease.panner.disconnect();
  } catch {
    /* first use */
  }
  lease.panner.connect(AudioContextEngine.get().sfxInput);
}

function syncPanner(panner: PannerNode, position: Vector3): void {
  panner.positionX.value = position.x;
  panner.positionY.value = position.y;
  panner.positionZ.value = position.z;
}

function wrapLease(lease: OneShotLease): AudioOneShotVoice {
  return {
    input: lease.input,
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

function sweepExpiredLeases(): void {
  const now = AudioContextEngine.get().context.currentTime;
  for (let index = active.length - 1; index >= 0; index -= 1) {
    const lease = active[index];
    if (lease.releaseAt <= now) {
      releaseLease(lease);
    }
  }
}

function makeRoomForLease(): void {
  sweepExpiredLeases();
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
}

function stopAndDisconnect(node: AudioNode): void {
  if (isScheduledSource(node)) {
    try {
      node.stop();
    } catch {
      /* already stopped */
    }
  }

  try {
    node.disconnect();
  } catch {
    /* already torn down */
  }
}

function isScheduledSource(node: AudioNode): node is AudioScheduledSourceNode {
  return 'stop' in node && typeof node.stop === 'function';
}
