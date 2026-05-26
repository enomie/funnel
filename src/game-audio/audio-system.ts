// Path: /Users/johann/MyBrew/funnel-real/src/game-audio/audio-system.ts

import { Vector3 } from 'three/webgpu';
import type { CameraVectors } from '../player/player-camera';
import { PLAYER_GROUNDED_CENTER_Y } from '../config/game-config';
import {
  AUDIO_DISTANCE_MODEL,
  AUDIO_FOOTSTEP_RANGE_M,
  AUDIO_FOOTSTEP_RANGE_SQ,
  AUDIO_FOOTSTEP_REF_DISTANCE_M,
  AUDIO_FOOTSTEP_ROLLOFF_FACTOR,
  AUDIO_HEARING_RANGE_M,
  AUDIO_HEARING_RANGE_SQ,
  AUDIO_MAP_WIDE_RANGE_M,
  AUDIO_MAP_WIDE_RANGE_SQ,
  AUDIO_MAP_WIDE_REF_DISTANCE_M,
  AUDIO_MAP_WIDE_ROLLOFF_FACTOR,
  AUDIO_PANNER_MODEL,
  AUDIO_PANNER_REF_DISTANCE_M,
  AUDIO_PANNER_ROLLOFF_FACTOR
} from './audio-config';
import { AudioContextEngine } from './audio-mixer';
import { isAudioAlive } from './audio-guard';
import { syncListenerPositionAndOrientation } from './audio-spatial-sync';

const WORLD_UP_Y = 1;
const LISTENER_EPSILON_SQ = 0.000001;

const _position = new Vector3();
const _forward = new Vector3();
const _listenerScratch = new Vector3();
const _spatialScratch = new Vector3();

export type SpatialAudioRange = 'near' | 'combat' | 'mapWide';

export interface AudioPoint {
  x: number;
  y: number;
  z: number;
}

const _capsuleFootScratch: AudioPoint = { x: 0, y: 0, z: 0 };

export function fillCapsuleFootPoint(
  center: AudioPoint,
  out: AudioPoint = _capsuleFootScratch
): AudioPoint {
  out.x = center.x;
  out.y = center.y - PLAYER_GROUNDED_CENTER_Y;
  out.z = center.z;
  return out;
}


export function capsuleFootPoint(center: AudioPoint): AudioPoint {
  return fillCapsuleFootPoint(center, {
    x: center.x,
    y: center.y - PLAYER_GROUNDED_CENTER_Y,
    z: center.z
  });
}

export function spatialVectorFromPoint(point: AudioPoint): Vector3 {
  return _spatialScratch.set(point.x, point.y, point.z);
}

let _lastOriginX = Number.NaN;
let _lastOriginY = 0;
let _lastOriginZ = 0;
let _lastForwardX = Number.NaN;
let _lastForwardY = 0;
let _lastForwardZ = 0;

export function readAudioListenerPosition(out: Vector3): Vector3 {
  return out.copy(_position);
}

export function syncAudioListenerFromCamera(vectors: CameraVectors): void {
  if (!isAudioAlive()) {
    return;
  }

  const origin = vectors.origin;
  const forward = vectors.direction;

  if (!hasListenerMoved(origin, forward)) {
    return;
  }

  _position.copy(origin);
  _forward.copy(forward);

  syncListenerPositionAndOrientation(
    AudioContextEngine.get().context.listener,
    origin,
    forward,
    { x: 0, y: WORLD_UP_Y, z: 0 }
  );
}

export function distanceSqFromListener(source: Vector3): number {
  return readAudioListenerPosition(_listenerScratch).distanceToSquared(source);
}


export function isWithinHearingRange(source: Vector3, range: SpatialAudioRange = 'combat'): boolean {
  const maxSq =
    range === 'near'
      ? AUDIO_FOOTSTEP_RANGE_SQ
      : range === 'mapWide'
        ? AUDIO_MAP_WIDE_RANGE_SQ
        : AUDIO_HEARING_RANGE_SQ;
  return distanceSqFromListener(source) <= maxSq;
}

export function setupSpatialPanner(panner: PannerNode, range: SpatialAudioRange = 'combat'): void {
  panner.panningModel = AUDIO_PANNER_MODEL;
  panner.distanceModel = AUDIO_DISTANCE_MODEL;

  if (range === 'near') {
    panner.maxDistance = AUDIO_FOOTSTEP_RANGE_M;
    panner.refDistance = AUDIO_FOOTSTEP_REF_DISTANCE_M;
    panner.rolloffFactor = AUDIO_FOOTSTEP_ROLLOFF_FACTOR;
    return;
  }

  if (range === 'mapWide') {
    panner.maxDistance = AUDIO_MAP_WIDE_RANGE_M;
    panner.refDistance = AUDIO_MAP_WIDE_REF_DISTANCE_M;
    panner.rolloffFactor = AUDIO_MAP_WIDE_ROLLOFF_FACTOR;
    return;
  }

  panner.maxDistance = AUDIO_HEARING_RANGE_M;
  panner.refDistance = AUDIO_PANNER_REF_DISTANCE_M;
  panner.rolloffFactor = AUDIO_PANNER_ROLLOFF_FACTOR;
}

function hasListenerMoved(
  origin: { x: number; y: number; z: number },
  forward: { x: number; y: number; z: number }
): boolean {
  const originDx = origin.x - _lastOriginX;
  const originDy = origin.y - _lastOriginY;
  const originDz = origin.z - _lastOriginZ;
  const forwardDx = forward.x - _lastForwardX;
  const forwardDy = forward.y - _lastForwardY;
  const forwardDz = forward.z - _lastForwardZ;

  if (
    originDx * originDx + originDy * originDy + originDz * originDz <= LISTENER_EPSILON_SQ &&
    forwardDx * forwardDx + forwardDy * forwardDy + forwardDz * forwardDz <= LISTENER_EPSILON_SQ
  ) {
    return false;
  }

  _lastOriginX = origin.x;
  _lastOriginY = origin.y;
  _lastOriginZ = origin.z;
  _lastForwardX = forward.x;
  _lastForwardY = forward.y;
  _lastForwardZ = forward.z;
  return true;
}
