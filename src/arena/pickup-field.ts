// Path: /Users/johann/MyBrew/funnel-real/src/arena/pickup-field.ts

import RAPIER from '@dimforge/rapier3d-simd-compat';
import type { RigidBody, World } from '@dimforge/rapier3d-simd-compat';
import {
  BoxGeometry,
  Euler,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Scene,
  Vector3
} from 'three/webgpu';
import { PICKUP_FIELD_CONFIG } from '../config/game-config';
import type { ActorRegistry } from '../combat/actor-registry';
import type { AudioPoint } from '../game-audio/audio-system';
import { applyPickupPhysicsColliderDesc } from './environment-physics-material';
import { randomPickupSpawnCenter } from './environment-rain-bounds';
import { getUnitLowPolySphereGeometry } from '../render/low-poly-sphere-geometry';

export type PickupKind = 'health' | 'shield';

export interface PickupFieldDeps {
  readonly scene: Scene;
  readonly world: World;
  readonly registry: ActorRegistry;
  readonly onCollected?: (kind: PickupKind, origin: AudioPoint) => void;
}

interface PickupSlot {
  readonly kind: PickupKind;
  readonly slotIndex: number;
  body: RigidBody | null;
}

const _spawnEuler = new Euler();
const _spawnQuaternion = new Quaternion();
const _composePosition = new Vector3();
const _composeQuaternion = new Quaternion();
const _composeScale = new Vector3(1, 1, 1);
const _composeMatrix = new Matrix4();
const _hiddenMatrix = new Matrix4().compose(
  new Vector3(0, -5000, 0),
  new Quaternion(),
  new Vector3(0.001, 0.001, 0.001)
);

function randomDropRotation(out: Quaternion): Quaternion {
  return out.setFromEuler(
    _spawnEuler.set(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    )
  );
}

function createPickupMaterial(color: number): MeshBasicMaterial {
  return new MeshBasicMaterial({ color });
}

function pickupHalfExtentY(kind: PickupKind): number {
  return kind === 'health'
    ? PICKUP_FIELD_CONFIG.health.size[1] * 0.5
    : PICKUP_FIELD_CONFIG.shield.radius;
}


export class PickupField {
  readonly #world: World;
  readonly #registry: ActorRegistry;
  readonly #onCollected: PickupFieldDeps['onCollected'];
  readonly #slots: PickupSlot[] = [];
  readonly #healthMesh: InstancedMesh;
  readonly #shieldMesh: InstancedMesh;
  readonly #collectRadiusSq: number;
  readonly #shieldScale: number;
  #started = false;

  constructor(deps: PickupFieldDeps) {
    this.#world = deps.world;
    this.#registry = deps.registry;
    this.#onCollected = deps.onCollected;
    this.#collectRadiusSq = PICKUP_FIELD_CONFIG.collectRadiusM ** 2;
    this.#shieldScale = PICKUP_FIELD_CONFIG.shield.radius;

    const [healthW, healthH, healthD] = PICKUP_FIELD_CONFIG.health.size;
    this.#healthMesh = new InstancedMesh(
      new BoxGeometry(healthW, healthH, healthD),
      createPickupMaterial(PICKUP_FIELD_CONFIG.health.color),
      PICKUP_FIELD_CONFIG.healthCount
    );
    this.#healthMesh.name = 'pickup-health-field';
    this.#healthMesh.frustumCulled = false;
    this.#healthMesh.count = PICKUP_FIELD_CONFIG.healthCount;
    deps.scene.add(this.#healthMesh);

    this.#shieldMesh = new InstancedMesh(
      getUnitLowPolySphereGeometry(),
      createPickupMaterial(PICKUP_FIELD_CONFIG.shield.color),
      PICKUP_FIELD_CONFIG.shieldCount
    );
    this.#shieldMesh.name = 'pickup-shield-field';
    this.#shieldMesh.frustumCulled = false;
    this.#shieldMesh.count = PICKUP_FIELD_CONFIG.shieldCount;
    deps.scene.add(this.#shieldMesh);

    for (let slotIndex = 0; slotIndex < PICKUP_FIELD_CONFIG.healthCount; slotIndex += 1) {
      this.#slots.push({ kind: 'health', slotIndex, body: null });
      this.#healthMesh.setMatrixAt(slotIndex, _hiddenMatrix);
    }
    for (let slotIndex = 0; slotIndex < PICKUP_FIELD_CONFIG.shieldCount; slotIndex += 1) {
      this.#slots.push({ kind: 'shield', slotIndex, body: null });
      this.#shieldMesh.setMatrixAt(slotIndex, _hiddenMatrix);
    }
    this.#healthMesh.instanceMatrix.needsUpdate = true;
    this.#shieldMesh.instanceMatrix.needsUpdate = true;
  }

  
  begin(): void {
    if (this.#started) {
      return;
    }

    this.#started = true;
    for (const slot of this.#slots) {
      this.#spawnDrop(slot);
    }
  }

  get isStarted(): boolean {
    return this.#started;
  }

  tick(): void {
    if (!this.#started) {
      return;
    }

    this.#syncVisuals();
    this.#tryCollect();
  }

  #spawnDrop(slot: PickupSlot): void {
    if (slot.body !== null) {
      this.#world.removeRigidBody(slot.body);
      slot.body = null;
    }

    const [x, y, z] = randomPickupSpawnCenter(pickupHalfExtentY(slot.kind));
    const rotation = randomDropRotation(_spawnQuaternion);
    const body = this.#world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .setRotation({ w: rotation.w, x: rotation.x, y: rotation.y, z: rotation.z })
        .setCanSleep(true)
    );

    const colliderDesc =
      slot.kind === 'health'
        ? RAPIER.ColliderDesc.cuboid(
            PICKUP_FIELD_CONFIG.health.size[0] * 0.5,
            PICKUP_FIELD_CONFIG.health.size[1] * 0.5,
            PICKUP_FIELD_CONFIG.health.size[2] * 0.5
          )
        : RAPIER.ColliderDesc.ball(PICKUP_FIELD_CONFIG.shield.radius);

    this.#world.createCollider(
      applyPickupPhysicsColliderDesc(colliderDesc, PICKUP_FIELD_CONFIG.density),
      body
    );
    body.wakeUp();
    slot.body = body;
    this.#writeSlotMatrix(slot, body);
    this.#markMeshDirty(slot.kind);
  }

  #syncVisuals(): void {
    let healthDirty = false;
    let shieldDirty = false;

    for (const slot of this.#slots) {
      const body = slot.body;
      if (body === null) {
        continue;
      }

      this.#writeSlotMatrix(slot, body);
      if (slot.kind === 'health') {
        healthDirty = true;
      } else {
        shieldDirty = true;
      }
    }

    if (healthDirty) {
      this.#healthMesh.instanceMatrix.needsUpdate = true;
    }
    if (shieldDirty) {
      this.#shieldMesh.instanceMatrix.needsUpdate = true;
    }
  }

  #writeSlotMatrix(slot: PickupSlot, body: RigidBody): void {
    const translation = body.translation();
    const rotation = body.rotation();
    _composePosition.set(translation.x, translation.y, translation.z);
    _composeQuaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    if (slot.kind === 'shield') {
      _composeScale.set(this.#shieldScale, this.#shieldScale, this.#shieldScale);
    } else {
      _composeScale.set(1, 1, 1);
    }
    _composeMatrix.compose(_composePosition, _composeQuaternion, _composeScale);

    if (slot.kind === 'health') {
      this.#healthMesh.setMatrixAt(slot.slotIndex, _composeMatrix);
    } else {
      this.#shieldMesh.setMatrixAt(slot.slotIndex, _composeMatrix);
    }
  }

  #markMeshDirty(kind: PickupKind): void {
    if (kind === 'health') {
      this.#healthMesh.instanceMatrix.needsUpdate = true;
    } else {
      this.#shieldMesh.instanceMatrix.needsUpdate = true;
    }
  }

  #tryCollect(): void {
    this.#registry.forEachActor((actor) => {
      if (actor.health.isDead) {
        return;
      }

      const actorBody = actor.body.translation();

      for (const slot of this.#slots) {
        const pickupBody = slot.body;
        if (pickupBody === null) {
          continue;
        }

        if (slot.kind === 'shield') {
          if (actor.health.shield >= actor.health.maxShield) {
            continue;
          }
        } else if (actor.health.health >= actor.health.maxHealth) {
          continue;
        }

        const pickup = pickupBody.translation();
        const dx = pickup.x - actorBody.x;
        const dy = pickup.y - actorBody.y;
        const dz = pickup.z - actorBody.z;
        if (dx * dx + dy * dy + dz * dz > this.#collectRadiusSq) {
          continue;
        }

        const granted =
          slot.kind === 'shield'
            ? actor.health.addShield(PICKUP_FIELD_CONFIG.shield.grantAmount)
            : actor.health.addHealth(PICKUP_FIELD_CONFIG.health.grantAmount);
        if (granted <= 0) {
          continue;
        }

        this.#onCollected?.(slot.kind, { x: pickup.x, y: pickup.y, z: pickup.z });
        this.#spawnDrop(slot);
      }
    });
  }
}
