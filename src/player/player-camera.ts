import RAPIER from '@dimforge/rapier3d-simd-compat';
import type { Collider, World } from '@dimforge/rapier3d-simd-compat';
import { PerspectiveCamera, Vector3 } from 'three/webgpu';
import { PLAYER_CONFIG } from '../config/game-config';
import type { PlayerFrame } from './player-controller';

export interface CameraVectors {
  origin: Vector3;
  direction: Vector3;
  target: Vector3;
}

export class PlayerCamera {
  readonly #camera: PerspectiveCamera;
  readonly #world: World;
  readonly #playerCollider: Collider;
  readonly #direction = new Vector3();
  readonly #target = new Vector3();
  readonly #right = new Vector3();

  constructor(camera: PerspectiveCamera, world: World, playerCollider: Collider) {
    this.#camera = camera;
    this.#world = world;
    this.#playerCollider = playerCollider;
  }

  update(frame: PlayerFrame): CameraVectors {
    const distance = frame.aimHeld ? 1.35 : PLAYER_CONFIG.cameraDistance;
    this.#direction
      .set(
        Math.sin(frame.yaw) * Math.cos(frame.pitch),
        Math.sin(frame.pitch),
        Math.cos(frame.yaw) * Math.cos(frame.pitch)
      )
      .normalize();

    this.#right.set(-Math.cos(frame.yaw), 0, Math.sin(frame.yaw)).normalize();
    this.#target.copy(frame.position).add(new Vector3(0, PLAYER_CONFIG.cameraHeight, 0));

    const desired = this.#target
      .clone()
      .addScaledVector(this.#direction, -distance)
      .addScaledVector(this.#right, frame.aimHeld ? PLAYER_CONFIG.cameraSide * 0.55 : PLAYER_CONFIG.cameraSide);

    const cameraPosition = this.#resolveCameraCollision(this.#target, desired);
    this.#camera.position.copy(cameraPosition);
    this.#camera.lookAt(this.#target.clone().addScaledVector(this.#direction, 18));
    this.#camera.fov = frame.aimHeld ? 50 : 76;
    this.#camera.updateProjectionMatrix();

    return {
      origin: this.#target.clone(),
      direction: this.#direction.clone(),
      target: this.#target.clone()
    };
  }

  #resolveCameraCollision(target: Vector3, desired: Vector3): Vector3 {
    const offset = desired.clone().sub(target);
    const distance = offset.length();
    if (distance <= 0.001) {
      return desired;
    }

    const direction = offset.clone().normalize();
    const ray = new RAPIER.Ray(target, direction);
    const hit = this.#world.castRay(ray, distance, true, undefined, undefined, this.#playerCollider);

    if (hit === null) {
      return desired;
    }

    return target.clone().addScaledVector(direction, Math.max(0.35, hit.timeOfImpact - 0.2));
  }
}
