import { type Object3D, Vector3 } from 'three/webgpu';
import type { FireProfile } from './weapon-definitions';
import { fireDeliveryFor } from './weapon-definitions';
import { resolveHitscanRange } from './hitscan-weapon';

/** Projectile bots engage before hitscan falloff on short-range weapons. */
const PROJECTILE_ENGAGE_RANGE_M = 92;

export function aimDirectionFromYawPitch(
  yaw: number,
  pitch: number,
  out = new Vector3()
): Vector3 {
  const cosP = Math.cos(pitch);
  return out
    .set(Math.sin(yaw) * cosP, Math.sin(pitch), Math.cos(yaw) * cosP)
    .normalize();
}

export function resolveWeaponEngageRangeM(fire: FireProfile): number {
  const hitscanRange = resolveHitscanRange(fire);
  const delivery = fireDeliveryFor(fire);
  if (delivery === 'hitscan' || delivery === 'beamTick') {
    return hitscanRange;
  }

  return Math.max(hitscanRange, PROJECTILE_ENGAGE_RANGE_M);
}

export function resolveMuzzleWorldPosition(socket: Object3D, out = new Vector3()): Vector3 {
  socket.updateWorldMatrix(true, false);
  return socket.getWorldPosition(out);
}
