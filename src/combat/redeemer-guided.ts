import { Vector3 } from 'three/webgpu';
import type { WorldProjectileSim } from './world-projectile-sim';

/** Must match `projectileTags` on Redeemer RMB in `weapon-definitions.ts`. */
export const REDEEMER_GUIDED_PROJECTILE_TAG = 'redeemer-guided';

const GUIDED_MAX_FLIGHT_MS = 14_000;
const GUIDED_CAMERA_BACK_M = 3.4;
const GUIDED_CAMERA_UP_M = 0.42;
const GUIDED_LOOK_AHEAD_M = 10;

const _worldUp = new Vector3(0, 1, 0);
const _cur = new Vector3();
const _tgt = new Vector3();
const _right = new Vector3();
const _forward = new Vector3();

export interface GuidedRedeemerCameraState {
  position: Vector3;
  lookAt: Vector3;
  direction: Vector3;
}

export class RedeemerGuidedFlight {
  #sim: WorldProjectileSim | null = null;
  #projectileId = -1;
  #startedAtMs = 0;

  get isActive(): boolean {
    return this.#projectileId >= 0;
  }

  get projectileId(): number {
    return this.#projectileId;
  }

  tracksId(id: number): boolean {
    return this.#projectileId === id;
  }

  begin(sim: WorldProjectileSim, id: number, nowMs: number): void {
    this.#sim = sim;
    this.#projectileId = id;
    this.#startedAtMs = nowMs;
  }

  end(): void {
    this.#sim = null;
    this.#projectileId = -1;
    this.#startedAtMs = 0;
  }

  isExpired(nowMs: number): boolean {
    return this.isActive && nowMs - this.#startedAtMs > GUIDED_MAX_FLIGHT_MS;
  }

  resolveCamera(out: GuidedRedeemerCameraState): GuidedRedeemerCameraState | null {
    if (this.#sim === null || this.#projectileId < 0) {
      return null;
    }
    return this.#sim.getSteerState(this.#projectileId, out);
  }
}

export function projectileIsGuidedRedeemer(tags: readonly string[]): boolean {
  return tags.includes(REDEEMER_GUIDED_PROJECTILE_TAG);
}

export function directionFromYawPitch(yaw: number, pitch: number, out: Vector3): Vector3 {
  const cosPitch = Math.cos(pitch);
  return out
    .set(Math.sin(yaw) * cosPitch, Math.sin(pitch), Math.cos(yaw) * cosPitch)
    .normalize();
}

export function steerTowardDirection(
  current: Vector3,
  target: Vector3,
  maxRadians: number,
  out: Vector3
): Vector3 {
  _cur.copy(current).normalize();
  _tgt.copy(target).normalize();
  const dot = Math.max(-1, Math.min(1, _cur.dot(_tgt)));
  const angle = Math.acos(dot);
  if (angle <= 1e-6) {
    return out.copy(_tgt);
  }

  const t = Math.min(1, maxRadians / angle);
  const sinAngle = Math.sin(angle);
  const weightA = Math.sin((1 - t) * angle) / sinAngle;
  const weightB = Math.sin(t * angle) / sinAngle;
  return out.copy(_cur).multiplyScalar(weightA).addScaledVector(_tgt, weightB).normalize();
}

export function resolveGuidedRedeemerCamera(
  projectilePosition: Vector3,
  direction: Vector3,
  out: GuidedRedeemerCameraState
): GuidedRedeemerCameraState {
  _forward.copy(direction).normalize();
  _right.crossVectors(_forward, _worldUp).normalize();
  if (_right.lengthSq() <= 0.001) {
    _right.set(1, 0, 0);
  }

  out.direction.copy(_forward);
  out.position
    .copy(projectilePosition)
    .addScaledVector(_forward, -GUIDED_CAMERA_BACK_M)
    .addScaledVector(_worldUp, GUIDED_CAMERA_UP_M);
  out.lookAt.copy(projectilePosition).addScaledVector(_forward, GUIDED_LOOK_AHEAD_M);
  return out;
}
