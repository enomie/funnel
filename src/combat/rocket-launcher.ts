// Path: /Users/johann/MyBrew/funnel-real/src/combat/rocket-launcher.ts

import { Vector3 } from 'three/webgpu';


const MARK_INTERVAL_MS = 280;

const BARREL_RING_RADIUS_M = 0.042;

const ROCKET_VOLLEY_FAN_STEP_RAD = 0.032;

export const ROCKET_VOLLEY_SHOT_INTERVAL_MS = 105;

const _worldUp = new Vector3(0, 1, 0);
const _right = new Vector3();
const _up = new Vector3();
const _offset = new Vector3();
const _forward = new Vector3();
const _aimDirection = new Vector3();

export class RocketLauncherMagazine {
  #barrelCount = 6;
  #nextBarrelIndex = 0;
  #markedCount = 0;
  #markHoldStartedAtMs = 0;
  #lastMarkAtMs = 0;

  reset(barrelCount: number): void {
    this.#barrelCount = barrelCount;
    this.#nextBarrelIndex = 0;
    this.#clearMarkState();
  }

  clear(): void {
    this.#barrelCount = 0;
    this.#nextBarrelIndex = 0;
    this.#clearMarkState();
  }

  get isActive(): boolean {
    return this.#barrelCount > 0;
  }

  get markedCount(): number {
    return this.#markedCount;
  }

  get isMarking(): boolean {
    return this.#markHoldStartedAtMs > 0;
  }

  canFirePrimary(ammoAvailable: number): boolean {
    return ammoAvailable > 0;
  }

  beginMarkHold(nowMs: number): void {
    this.#markHoldStartedAtMs = nowMs;
    this.#lastMarkAtMs = 0;
    this.#markedCount = 0;
  }

  
  tickMarkWhileHeld(nowMs: number, ammoAvailable: number): boolean {
    if (ammoAvailable <= this.#markedCount) {
      return false;
    }

    if (this.#markedCount === 0) {
      if (nowMs < this.#markHoldStartedAtMs + MARK_INTERVAL_MS) {
        return false;
      }
    } else if (nowMs < this.#lastMarkAtMs + MARK_INTERVAL_MS) {
      return false;
    }

    this.#markedCount += 1;
    this.#lastMarkAtMs = nowMs;
    return true;
  }

  
  consumePrimaryRound(): number {
    if (this.#barrelCount <= 0) {
      return -1;
    }

    const barrelIndex = this.#nextBarrelIndex;
    this.#nextBarrelIndex = (this.#nextBarrelIndex + 1) % this.#barrelCount;
    return barrelIndex;
  }

  
  peekVolleyCount(ammoAvailable: number): number {
    return Math.min(this.#markedCount, ammoAvailable);
  }

  commitVolley(): number {
    const toFire = this.#markedCount;
    this.#clearMarkState();
    return toFire;
  }

  cancelMarkHold(): void {
    this.#clearMarkState();
  }

  #clearMarkState(): void {
    this.#markedCount = 0;
    this.#markHoldStartedAtMs = 0;
    this.#lastMarkAtMs = 0;
  }
}

export function resolveRocketBarrelSpawn(
  muzzlePosition: Vector3,
  aimDirection: Vector3,
  barrelIndex: number,
  barrelCount: number,
  out: Vector3
): Vector3 {
  _forward.copy(aimDirection);
  if (_forward.lengthSq() <= 0.0001) {
    _forward.set(0, 0, 1);
  } else {
    _forward.normalize();
  }

  _right.crossVectors(_forward, _worldUp).normalize();
  if (_right.lengthSq() <= 0.001) {
    _right.set(1, 0, 0);
  }
  _up.crossVectors(_right, _forward).normalize();

  const angle = (Math.PI * 2 * barrelIndex) / Math.max(1, barrelCount);
  _offset
    .copy(_right)
    .multiplyScalar(Math.cos(angle) * BARREL_RING_RADIUS_M)
    .addScaledVector(_up, Math.sin(angle) * BARREL_RING_RADIUS_M);

  return out.copy(muzzlePosition).add(_offset);
}


export function resolveRocketVolleyDirection(
  aimDirection: Vector3,
  shotIndex: number,
  shotCount: number,
  spreadRadians: number,
  out: Vector3
): Vector3 {
  _aimDirection.copy(aimDirection);
  if (_aimDirection.lengthSq() <= 0.0001) {
    _aimDirection.set(0, 0, 1);
  } else {
    _aimDirection.normalize();
  }

  if (shotCount <= 1) {
    return out.copy(_aimDirection);
  }

  const stepRad = Math.max(spreadRadians, ROCKET_VOLLEY_FAN_STEP_RAD);
  const centeredIndex = shotIndex - (shotCount - 1) * 0.5;

  _right.crossVectors(_aimDirection, _worldUp).normalize();
  if (_right.lengthSq() <= 0.001) {
    _right.set(1, 0, 0);
  }

  const lateral = Math.tan(centeredIndex * stepRad);
  return out.copy(_aimDirection).addScaledVector(_right, lateral).normalize();
}
