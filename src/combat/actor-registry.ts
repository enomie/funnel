import type { Collider, RigidBody } from '@dimforge/rapier3d-simd-compat';
import type { CombatActor } from './combat-actor';

/** Planar grid cell (m) — funnel is long/narrow; ~40 actors max. */
const SPATIAL_CELL_M = 14;
const SPATIAL_CELL_OFFSET = 512;

function spatialCellKey(x: number, z: number): number {
  const cx = Math.floor(x / SPATIAL_CELL_M) + SPATIAL_CELL_OFFSET;
  const cz = Math.floor(z / SPATIAL_CELL_M) + SPATIAL_CELL_OFFSET;
  return (cx << 10) | cz;
}

const _xCellRange = { min: 0, max: 0 };
const _zCellRange = { min: 0, max: 0 };

function fillSpatialCellRange(min: number, max: number, out: { min: number; max: number }): void {
  out.min = Math.floor(min / SPATIAL_CELL_M);
  out.max = Math.floor(max / SPATIAL_CELL_M);
}

export class ActorRegistry {
  readonly #byColliderHandle = new Map<number, CombatActor>();
  readonly #byBodyHandle = new Map<number, CombatActor>();
  readonly #byActorId = new Map<string, CombatActor>();
  readonly #actors = new Set<CombatActor>();
  readonly #spatialCells = new Map<number, CombatActor[]>();
  #spatialFrameId = -1;

  register(actor: CombatActor): void {
    this.unregister(actor);

    this.#actors.add(actor);
    this.#byActorId.set(actor.id, actor);
    this.#byBodyHandle.set(actor.body.handle, actor);

    for (const collider of actor.colliders) {
      this.#byColliderHandle.set(collider.handle, actor);
    }
  }

  unregister(actor: CombatActor): void {
    if (!this.#actors.has(actor)) {
      return;
    }

    this.#actors.delete(actor);
    this.#byActorId.delete(actor.id);
    this.#byBodyHandle.delete(actor.body.handle);

    for (const collider of actor.colliders) {
      this.#byColliderHandle.delete(collider.handle);
    }
  }

  resolveCollider(collider: Collider): CombatActor | null {
    return this.#byColliderHandle.get(collider.handle) ?? null;
  }

  resolveRigidBody(body: RigidBody): CombatActor | null {
    return this.#byBodyHandle.get(body.handle) ?? null;
  }

  resolveActor(actorId: string): CombatActor | null {
    return this.#byActorId.get(actorId) ?? null;
  }

  /** Rebuild planar spatial buckets once per render frame before AoE / ripper queries. */
  beginFrame(frameId: number): void {
    if (this.#spatialFrameId === frameId) {
      return;
    }

    this.#spatialFrameId = frameId;

    for (const bucket of this.#spatialCells.values()) {
      bucket.length = 0;
    }

    for (const actor of this.#actors) {
      if (actor.health.isDead) {
        continue;
      }

      const translation = actor.body.translation();
      const key = spatialCellKey(translation.x, translation.z);
      let bucket = this.#spatialCells.get(key);
      if (bucket === undefined) {
        bucket = [];
        this.#spatialCells.set(key, bucket);
      }
      bucket.push(actor);
    }
  }

  /** Splash / blast / ripper broad-phase — only actors in overlapping grid cells. */
  forEachActorNear(
    centerX: number,
    centerY: number,
    centerZ: number,
    radius: number,
    callback: (actor: CombatActor) => void
  ): void {
    if (radius <= 0) {
      return;
    }

    const radiusSq = radius * radius;
    fillSpatialCellRange(centerX - radius, centerX + radius, _xCellRange);
    fillSpatialCellRange(centerZ - radius, centerZ + radius, _zCellRange);

    for (let cellX = _xCellRange.min; cellX <= _xCellRange.max; cellX += 1) {
      for (let cellZ = _zCellRange.min; cellZ <= _zCellRange.max; cellZ += 1) {
        const key = ((cellX + SPATIAL_CELL_OFFSET) << 10) | (cellZ + SPATIAL_CELL_OFFSET);
        const bucket = this.#spatialCells.get(key);
        if (bucket === undefined) {
          continue;
        }

        for (let index = 0; index < bucket.length; index += 1) {
          const actor = bucket[index];
          if (actor.health.isDead) {
            continue;
          }

          const bodyPoint = actor.body.translation();
          const dx = bodyPoint.x - centerX;
          const dy = bodyPoint.y - centerY;
          const dz = bodyPoint.z - centerZ;
          if (dx * dx + dy * dy + dz * dz > radiusSq) {
            continue;
          }

          callback(actor);
        }
      }
    }
  }

  /** Full roster — presence scoring, HUD counts, legacy paths. */
  forEachActor(callback: (actor: CombatActor) => void): void {
    for (const actor of this.#actors) {
      callback(actor);
    }
  }
}
