// Path: /Users/johann/MyBrew/funnel-real/src/arena/redeemer-pickup.ts

import { Group } from 'three/webgpu';
import type { Scene } from 'three/webgpu';
import type { CombatActor } from '../combat/combat-actor';
import type { ActorRegistry } from '../combat/actor-registry';
import { redeemerWeaponDefinition } from '../combat/spawn-weapon-roll';
import type { AudioPoint } from '../game-audio/audio-system';
import { createWeaponMesh } from '../weapon-jsons/weapon-mesh-builder';
import { REDEEMER_SPAWN_POSITION } from './neutral-podium';

const REDEEMER_PICKUP_RESPAWN_MS = 60_000;
const REDEEMER_PICKUP_COLLECT_RADIUS_M = 1.65;
const REDEEMER_PICKUP_SPIN_RAD_S = 2.1;
const REDEEMER_PICKUP_BOB_AMPLITUDE_M = 0.14;
const REDEEMER_PICKUP_BOB_RAD_S = 2.6;
const REDEEMER_PICKUP_DISPLAY_SCALE = 1.18;

const REDEEMER_PICKUP_MESH_TILT_RAD = Math.PI * 0.5;

export interface RedeemerPickupDeps {
  readonly scene: Scene;
  readonly registry: ActorRegistry;
  readonly onCollected: (collector: CombatActor, origin: AudioPoint) => void;
}


export class RedeemerPickup {
  readonly #registry: ActorRegistry;
  readonly #onCollected: RedeemerPickupDeps['onCollected'];
  readonly #root: Group;
  readonly #collectRadiusSq: number;
  readonly #anchorX = REDEEMER_SPAWN_POSITION.x;
  readonly #anchorY = REDEEMER_SPAWN_POSITION.y;
  readonly #anchorZ = REDEEMER_SPAWN_POSITION.z;
  #active = false;
  #visible = false;
  #respawnAtMs = 0;
  #spinAngleRad = 0;
  #bobPhaseRad = 0;

  constructor(deps: RedeemerPickupDeps) {
    this.#registry = deps.registry;
    this.#onCollected = deps.onCollected;
    this.#collectRadiusSq = REDEEMER_PICKUP_COLLECT_RADIUS_M ** 2;

    const weapon = redeemerWeaponDefinition();
    const mesh = createWeaponMesh(weapon);
    mesh.rotation.x = REDEEMER_PICKUP_MESH_TILT_RAD;
    mesh.scale.setScalar(REDEEMER_PICKUP_DISPLAY_SCALE);

    this.#root = new Group();
    this.#root.name = 'redeemer-pickup';
    this.#root.add(mesh);
    this.#root.visible = false;
    deps.scene.add(this.#root);
  }

  
  begin(): void {
    if (this.#active) {
      return;
    }

    this.#active = true;
    this.#show();
  }

  get isStarted(): boolean {
    return this.#active;
  }

  tick(nowMs: number, deltaSeconds: number): void {
    if (!this.#active) {
      return;
    }

    if (!this.#visible) {
      if (nowMs >= this.#respawnAtMs) {
        this.#show();
      }
      return;
    }

    this.#spinAngleRad += REDEEMER_PICKUP_SPIN_RAD_S * deltaSeconds;
    this.#bobPhaseRad += REDEEMER_PICKUP_BOB_RAD_S * deltaSeconds;
    const bobY = Math.sin(this.#bobPhaseRad) * REDEEMER_PICKUP_BOB_AMPLITUDE_M;
    this.#root.position.set(this.#anchorX, this.#anchorY + bobY, this.#anchorZ);
    this.#root.rotation.y = this.#spinAngleRad;

    this.#tryCollect(nowMs);
  }

  #show(): void {
    this.#visible = true;
    this.#root.visible = true;
    this.#root.position.set(this.#anchorX, this.#anchorY, this.#anchorZ);
  }

  #hide(respawnAtMs: number): void {
    this.#visible = false;
    this.#root.visible = false;
    this.#respawnAtMs = respawnAtMs;
  }

  #tryCollect(nowMs: number): void {
    let collector: CombatActor | undefined;
    let bestDistSq = Infinity;

    this.#registry.forEachActor((actor) => {
      if (actor.health.isDead) {
        return;
      }

      const body = actor.body.translation();
      const dx = body.x - this.#anchorX;
      const dy = body.y - this.#anchorY;
      const dz = body.z - this.#anchorZ;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq > this.#collectRadiusSq || distSq >= bestDistSq) {
        return;
      }

      bestDistSq = distSq;
      collector = actor;
    });

    if (collector === undefined) {
      return;
    }

    this.#hide(nowMs + REDEEMER_PICKUP_RESPAWN_MS);
    this.#onCollected(collector, {
      x: this.#anchorX,
      y: this.#anchorY,
      z: this.#anchorZ
    });
  }
}
