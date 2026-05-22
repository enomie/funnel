import RAPIER from '@dimforge/rapier3d-simd-compat';
import type { Collider, World } from '@dimforge/rapier3d-simd-compat';
import {
  BufferGeometry,
  Line,
  LineBasicMaterial,
  Scene,
  SphereGeometry,
  Mesh,
  MeshBasicMaterial,
  Vector3
} from 'three/webgpu';
import { WEAPON_CONFIG } from '../config/game-config';
import type { BuildingSystem } from '../arena/building-system';
import type { CameraVectors } from '../player/player-camera';

export class HitscanWeapon {
  readonly #scene: Scene;
  readonly #world: World;
  readonly #ignoredCollider: Collider;
  readonly #buildingSystem: BuildingSystem;
  readonly #audio = new WeaponAudio();
  readonly #temporaryObjects: Array<{ object: Line | Mesh; removeAt: number }> = [];
  #lastFireAt = 0;

  constructor(scene: Scene, world: World, ignoredCollider: Collider, buildingSystem: BuildingSystem) {
    this.#scene = scene;
    this.#world = world;
    this.#ignoredCollider = ignoredCollider;
    this.#buildingSystem = buildingSystem;
  }

  update(nowMs: number): void {
    while (this.#temporaryObjects.length > 0 && this.#temporaryObjects[0].removeAt <= nowMs) {
      const item = this.#temporaryObjects.shift();
      if (item !== undefined) {
        this.#scene.remove(item.object);
        if (item.object instanceof Line) {
          item.object.geometry.dispose();
        }
        const material = item.object.material;
        if (Array.isArray(material)) {
          for (const entry of material) {
            entry.dispose();
          }
        } else {
          material.dispose();
        }
      }
    }
  }

  tryFire(nowMs: number, vectors: CameraVectors, muzzlePosition: Vector3): boolean {
    if (nowMs < this.#lastFireAt + WEAPON_CONFIG.fireIntervalMs) {
      return false;
    }

    this.#lastFireAt = nowMs;
    this.#audio.playShot();

    const ray = new RAPIER.Ray(vectors.origin, vectors.direction);
    const hit = this.#world.castRay(
      ray,
      WEAPON_CONFIG.range,
      true,
      undefined,
      undefined,
      this.#ignoredCollider
    );
    const hitPoint =
      hit === null
        ? vectors.origin.clone().addScaledVector(vectors.direction, WEAPON_CONFIG.range)
        : new Vector3(
            ray.pointAt(hit.timeOfImpact).x,
            ray.pointAt(hit.timeOfImpact).y,
            ray.pointAt(hit.timeOfImpact).z
          );

    if (hit !== null) {
      const damagedBuild = this.#buildingSystem.damage(hit.collider, WEAPON_CONFIG.damage);
      this.#audio.playImpact(damagedBuild ? 0.22 : 0.08);
      this.#spawnImpact(hitPoint);
    }

    this.#spawnTracer(muzzlePosition, hitPoint);
    return true;
  }

  #spawnTracer(start: Vector3, end: Vector3): void {
    const geometry = new BufferGeometry().setFromPoints([start, end]);
    const material = new LineBasicMaterial({ color: 0xffd17a });
    const line = new Line(geometry, material);
    this.#scene.add(line);
    this.#temporaryObjects.push({
      object: line,
      removeAt: performance.now() + WEAPON_CONFIG.tracerDurationMs
    });
  }

  #spawnImpact(position: Vector3): void {
    const mesh = new Mesh(
      new SphereGeometry(0.16, 10, 8),
      new MeshBasicMaterial({ color: 0xff8f3a })
    );
    mesh.position.copy(position);
    this.#scene.add(mesh);
    this.#temporaryObjects.push({
      object: mesh,
      removeAt: performance.now() + 190
    });
  }
}

class WeaponAudio {
  #context: AudioContext | null = null;

  playShot(): void {
    this.#playTone(110, 0.038, 0.08, 'sawtooth');
    this.#playTone(680, 0.022, 0.035, 'square');
  }

  playImpact(volume: number): void {
    this.#playTone(190, 0.045, volume, 'triangle');
  }

  #playTone(frequency: number, duration: number, volume: number, type: OscillatorType): void {
    const context = this.#context ?? new AudioContext();
    this.#context = context;

    if (context.state === 'suspended') {
      void context.resume();
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  }
}
