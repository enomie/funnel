import type { Vector3 } from 'three/webgpu';
import { setupSpatialPanner } from '../audio-system';

export function createFlybyPanner(context: AudioContext, position: Vector3): PannerNode {
  const panner = context.createPanner();
  const time = context.currentTime;
  setupSpatialPanner(panner);
  panner.positionX.setValueAtTime(position.x, time);
  panner.positionY.setValueAtTime(position.y, time);
  panner.positionZ.setValueAtTime(position.z, time);
  return panner;
}

export function syncFlybyPanner(panner: PannerNode, position: Vector3, velocity?: Vector3): void {
  panner.positionX.value = position.x;
  panner.positionY.value = position.y;
  panner.positionZ.value = position.z;

  if (velocity === undefined) {
    return;
  }

  const doppler = panner as PannerNode & {
    velocityX?: AudioParam;
    velocityY?: AudioParam;
    velocityZ?: AudioParam;
  };
  if (
    doppler.velocityX !== undefined &&
    doppler.velocityY !== undefined &&
    doppler.velocityZ !== undefined
  ) {
    doppler.velocityX.value = velocity.x;
    doppler.velocityY.value = velocity.y;
    doppler.velocityZ.value = velocity.z;
  }
}
