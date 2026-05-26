// Path: /Users/johann/MyBrew/funnel-real/src/physics/physics-interpolation.ts

import type { RigidBody } from '@dimforge/rapier3d-simd-compat';
import { PHYSICS_CONFIG } from '../config/game-config';

export function writeBodyTranslationSnapshot(
  body: RigidBody,
  out: PhysicsTranslationSnapshot
): PhysicsTranslationSnapshot {
  const translation = body.translation();
  out.x = translation.x;
  out.y = translation.y;
  out.z = translation.z;
  return out;
}

export interface PhysicsTranslationSnapshot {
  x: number;
  y: number;
  z: number;
}

export class PhysicsTranslationInterpolator {
  readonly previous: PhysicsTranslationSnapshot = { x: 0, y: 0, z: 0 };
  readonly current: PhysicsTranslationSnapshot = { x: 0, y: 0, z: 0 };
  #initialized = false;

  seedFromBody(body: RigidBody): void {
    const translation = body.translation();
    this.previous.x = translation.x;
    this.previous.y = translation.y;
    this.previous.z = translation.z;
    this.current.x = translation.x;
    this.current.y = translation.y;
    this.current.z = translation.z;
    this.#initialized = true;
  }

  captureAfterPhysicsStep(body: RigidBody): void {
    if (!this.#initialized) {
      this.seedFromBody(body);
      return;
    }

    this.previous.x = this.current.x;
    this.previous.y = this.current.y;
    this.previous.z = this.current.z;
    const translation = body.translation();
    this.current.x = translation.x;
    this.current.y = translation.y;
    this.current.z = translation.z;
  }

  fillInterpolated(
    blend: number,
    out: PhysicsTranslationSnapshot
  ): PhysicsTranslationSnapshot {
    const t = blend <= 0 ? 0 : blend >= 1 ? 1 : blend;
    out.x = this.previous.x + (this.current.x - this.previous.x) * t;
    out.y = this.previous.y + (this.current.y - this.previous.y) * t;
    out.z = this.previous.z + (this.current.z - this.previous.z) * t;
    return out;
  }
}

const _interpolatedScratch: PhysicsTranslationSnapshot = { x: 0, y: 0, z: 0 };

export function computeRenderInterpolationBlend(
  physicsAccumulator: number,
  subSteps: number
): number {
  if (subSteps <= 0) {
    return 1;
  }

  const { fixedStep } = PHYSICS_CONFIG;
  const alpha = physicsAccumulator / fixedStep;
  if (alpha <= 0) {
    return 1;
  }

  if (alpha >= 1) {
    return 0;
  }

  return 1 - alpha;
}

export function fillInterpolatedBodyTranslation(
  interpolator: PhysicsTranslationInterpolator,
  blend: number,
  out: PhysicsTranslationSnapshot = _interpolatedScratch
): PhysicsTranslationSnapshot {
  return interpolator.fillInterpolated(blend, out);
}

export function fillHumanoidRenderTranslation(
  interpolator: PhysicsTranslationInterpolator,
  blend: number,
  body: RigidBody,
  skipInterpolation: boolean,
  out: PhysicsTranslationSnapshot = _interpolatedScratch
): PhysicsTranslationSnapshot {
  if (skipInterpolation) {
    return writeBodyTranslationSnapshot(body, out);
  }

  return fillInterpolatedBodyTranslation(interpolator, blend, out);
}
