// Path: /Users/johann/MyBrew/funnel-real/src/game-audio/audio-spatial-sync.ts

import type { Vector3 } from 'three/webgpu';
import type { AudioPoint } from './audio-system';

type LegacyAudioListener = AudioListener & {
  setPosition(x: number, y: number, z: number): void;
  setOrientation(
    forwardX: number,
    forwardY: number,
    forwardZ: number,
    upX: number,
    upY: number,
    upZ: number
  ): void;
};

let listenerUsesParamApi: boolean | null = null;

function listenerHasParamApi(listener: AudioListener): boolean {
  if (listenerUsesParamApi === null) {
    listenerUsesParamApi = 'positionX' in listener;
  }
  return listenerUsesParamApi;
}

export function syncListenerPositionAndOrientation(
  listener: AudioListener,
  position: AudioPoint | Vector3,
  forward: AudioPoint | Vector3,
  up: AudioPoint | Vector3
): void {
  if (listenerHasParamApi(listener)) {
    listener.positionX.value = position.x;
    listener.positionY.value = position.y;
    listener.positionZ.value = position.z;
    listener.forwardX.value = forward.x;
    listener.forwardY.value = forward.y;
    listener.forwardZ.value = forward.z;
    listener.upX.value = up.x;
    listener.upY.value = up.y;
    listener.upZ.value = up.z;
    return;
  }

  const legacy = listener as LegacyAudioListener;
  /* Firefox still exposes setPosition/setOrientation instead of AudioParam properties. */
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- legacy Web Audio listener API
  legacy.setPosition(position.x, position.y, position.z);
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- legacy Web Audio listener API
  legacy.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
}

export function syncPannerPositionImmediate(
  panner: PannerNode,
  position: AudioPoint | Vector3
): void {
  panner.positionX.value = position.x;
  panner.positionY.value = position.y;
  panner.positionZ.value = position.z;
}


export function setAudioParamImmediate(param: AudioParam, value: number): void {
  param.value = value;
}


export function syncPannerVelocityImmediate(
  panner: PannerNode,
  velocity: Vector3
): void {
  const doppler = panner as PannerNode & {
    velocityX?: AudioParam;
    velocityY?: AudioParam;
    velocityZ?: AudioParam;
  };
  if (
    doppler.velocityX === undefined ||
    doppler.velocityY === undefined ||
    doppler.velocityZ === undefined
  ) {
    return;
  }

  doppler.velocityX.value = velocity.x;
  doppler.velocityY.value = velocity.y;
  doppler.velocityZ.value = velocity.z;
}
