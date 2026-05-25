// Path: /Users/johann/MyBrew/funnel-real/src/render/combat-point-light-pool.ts

import { PointLight, Scene } from 'three/webgpu';


export const COMBAT_POINT_LIGHT_POOL_CAP = 12;

export class CombatPointLightPool {
  readonly #lights: PointLight[] = [];
  readonly #inUse = new Uint8Array(COMBAT_POINT_LIGHT_POOL_CAP);
  readonly #freeSlots: number[] = [];

  constructor(scene: Scene) {
    for (let slot = 0; slot < COMBAT_POINT_LIGHT_POOL_CAP; slot += 1) {
      const light = new PointLight(0xffffff, 0, 8, 2);
      light.name = `combat-point-light-${String(slot)}`;
      light.castShadow = false;
      light.intensity = 0;
      scene.add(light);
      this.#lights.push(light);
      this.#freeSlots.push(COMBAT_POINT_LIGHT_POOL_CAP - 1 - slot);
    }
  }

  acquire(): number {
    const slot = this.#freeSlots.pop();
    if (slot === undefined) {
      return -1;
    }
    this.#inUse[slot] = 1;
    return slot;
  }

  release(slot: number): void {
    if (slot < 0 || slot >= COMBAT_POINT_LIGHT_POOL_CAP || this.#inUse[slot] === 0) {
      return;
    }

    this.#lights[slot].intensity = 0;
    this.#inUse[slot] = 0;
    this.#freeSlots.push(slot);
  }

  sync(
    slot: number,
    x: number,
    y: number,
    z: number,
    color: number,
    intensity: number,
    distance: number,
    decay = 2
  ): void {
    if (slot < 0 || slot >= COMBAT_POINT_LIGHT_POOL_CAP || this.#inUse[slot] === 0) {
      return;
    }

    const light = this.#lights[slot];
    light.position.set(x, y, z);
    light.color.setHex(color);
    light.intensity = intensity;
    light.distance = distance;
    light.decay = decay;
  }

  releaseAll(): void {
    for (let slot = 0; slot < COMBAT_POINT_LIGHT_POOL_CAP; slot += 1) {
      if (this.#inUse[slot] === 1) {
        this.release(slot);
      }
    }
  }

  hasActive(): boolean {
    for (let slot = 0; slot < COMBAT_POINT_LIGHT_POOL_CAP; slot += 1) {
      if (this.#inUse[slot] === 1) {
        return true;
      }
    }
    return false;
  }
}
