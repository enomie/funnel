// Path: /Users/johann/MyBrew/funnel-real/src/arena/environment-rain-spawner.ts

import type { RigidBody, World } from '@dimforge/rapier3d-simd-compat';
import { Euler, Quaternion } from 'three/webgpu';
import { createDynamicEnvironmentProp } from './environment-dynamic-body';
import type { DynamicEnvironmentInstances, DynamicSyncedBody } from './environment-dynamic-instances';
import { randomCountdownRainSpawnCenter } from './environment-rain-bounds';
import { resolveRainWaves, type RainWaveSpec } from './environment-rain-waves';


const DROP_INTERVAL_S = 0.05;
const SETTLE_SPEED_EPS = 0.05;
const SETTLE_FRAMES_REQUIRED = 15;

export interface EnvironmentRainSpawnerDeps {
  readonly instances: DynamicEnvironmentInstances;
  readonly world: World;
  readonly dynamicBodies: DynamicSyncedBody[];
}

const _spawnEuler = new Euler();
const _spawnQuaternion = new Quaternion();

function randomSpawnRotation(out: Quaternion): Quaternion {
  return out.setFromEuler(
    _spawnEuler.set(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    )
  );
}

function isBodySettled(body: RigidBody): boolean {
  if (body.isSleeping()) {
    return true;
  }

  const linvel = body.linvel();
  const speedSq = linvel.x * linvel.x + linvel.y * linvel.y + linvel.z * linvel.z;
  return speedSq <= SETTLE_SPEED_EPS * SETTLE_SPEED_EPS;
}


export class EnvironmentRainSpawner {
  readonly #deps: EnvironmentRainSpawnerDeps;
  readonly #spawnedBodies: DynamicSyncedBody[] = [];
  #waves: readonly RainWaveSpec[] = [];
  #started = false;
  #complete = false;
  #allSpawned = false;
  #waveIndex = 0;
  #pieceIndex = 0;
  #spawnElapsedS = DROP_INTERVAL_S;
  #finalSettleFrames = 0;

  constructor(deps: EnvironmentRainSpawnerDeps) {
    this.#deps = deps;
  }

  start(): void {
    this.#waves = resolveRainWaves();
    this.#started = true;
    if (this.#waves.length === 0) {
      this.#allSpawned = true;
      this.#complete = true;
    }
  }

  isComplete(): boolean {
    return this.#complete;
  }

  tick(deltaSeconds: number): void {
    if (!this.#started || this.#complete) {
      return;
    }

    if (!this.#allSpawned) {
      this.#spawnElapsedS += deltaSeconds;
      if (this.#spawnElapsedS >= DROP_INTERVAL_S) {
        this.#spawnElapsedS -= DROP_INTERVAL_S;
        this.#spawnNextPiece();
      }
      return;
    }

    if (this.#spawnedBodies.every((entry) => isBodySettled(entry.body))) {
      this.#finalSettleFrames += 1;
    } else {
      this.#finalSettleFrames = 0;
    }

    if (this.#finalSettleFrames >= SETTLE_FRAMES_REQUIRED) {
      this.#complete = true;
    }
  }

  #spawnNextPiece(): void {
    if (this.#waveIndex >= this.#waves.length) {
      this.#allSpawned = true;
      return;
    }

    const wave = this.#waves.at(this.#waveIndex);
    if (wave === undefined) {
      this.#allSpawned = true;
      return;
    }

    if (this.#pieceIndex >= wave.count) {
      this.#advanceWave();
      if (this.#allSpawned) {
        return;
      }
      this.#spawnNextPiece();
      return;
    }

    const [x, y, z] = randomCountdownRainSpawnCenter(wave.shape);
    const synced = createDynamicEnvironmentProp(
      this.#deps.instances,
      this.#deps.world,
      wave.shape,
      [x, y, z],
      randomSpawnRotation(_spawnQuaternion)
    );
    this.#deps.dynamicBodies.push(synced);
    this.#spawnedBodies.push(synced);
    this.#pieceIndex += 1;
  }

  #advanceWave(): void {
    this.#waveIndex += 1;
    this.#pieceIndex = 0;

    if (this.#waveIndex >= this.#waves.length) {
      this.#allSpawned = true;
    }
  }
}
