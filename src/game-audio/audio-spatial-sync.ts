// Path: /Users/johann/MyBrew/funnel-real/src/game-audio/audio-spatial-sync.ts

import type { Vector3 } from 'three/webgpu';
import type { AudioPoint } from './audio-system';


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
