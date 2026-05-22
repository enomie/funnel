import RAPIER from '@dimforge/rapier3d-simd-compat';
import type { Collider, World } from '@dimforge/rapier3d-simd-compat';
import {
  BufferGeometry,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PointLight,
  Scene,
  SphereGeometry,
  Vector3
} from 'three/webgpu';
import type { BuildingSystem } from '../arena/building-system';
import type { CameraVectors } from '../player/player-camera';
import { alignProjectileVisual, createProjectileVisual } from './projectile-visuals';
import { WEAPON_DEFINITIONS, type WeaponDefinition } from './weapon-definitions';

const RIPPER_RICOCHET_LIMIT = 3;
const BOUNCE_SURFACE_NUDGE = 0.035;
const MIN_STEP_DISTANCE = 0.001;
const MAX_COLLISION_STEPS_PER_FRAME = RIPPER_RICOCHET_LIMIT + 1;
const PROJECTILE_LIGHT_POOL_SIZE = 8;
const PROJECTILE_LIGHT_INTENSITY = 2.35;
const PROJECTILE_LIGHT_RANGE = 7.2;
const PROJECTILE_LIGHT_DECAY = 1.45;
const TRAIL_SPAWN_INTERVAL_MS = 26;
const TRAIL_OPACITY = 0.94;
const TRAIL_REMOVE_AFTER_MS = 90;
const IMPACT_REMOVE_AFTER_MS = 210;
const TRAIL_MATERIAL_CACHE = new Map<number, LineBasicMaterial>();
const IMPACT_MATERIAL_CACHE = new Map<number, MeshBasicMaterial>();
const IMPACT_GEOMETRY_CACHE = new Map<number, SphereGeometry>();

interface ActiveProjectile {
  weapon: WeaponDefinition;
  object: Object3D;
  position: Vector3;
  direction: Vector3;
  traveled: number;
  spin: Vector3;
  ricochetsRemaining: number;
  lastTrailAt: number;
}

interface ProjectileHit {
  collider: Collider;
  point: Vector3;
  normal: Vector3;
  distance: number;
}

export class WeaponArsenal {
  readonly #scene: Scene;
  readonly #world: World;
  readonly #ignoredCollider: Collider;
  readonly #buildingSystem: BuildingSystem;
  readonly #audio = new WeaponAudio();
  readonly #projectiles: ActiveProjectile[] = [];
  readonly #projectileLights: PointLight[] = [];
  readonly #litProjectiles: ActiveProjectile[] = [];
  readonly #litProjectilePriorities: number[] = [];
  readonly #temporaryObjects: Array<{ object: Object3D; removeAt: number; dispose: () => void }> = [];
  #selectedSlot = 0;
  #lastFireAt = 0;

  constructor(scene: Scene, world: World, ignoredCollider: Collider, buildingSystem: BuildingSystem) {
    this.#scene = scene;
    this.#world = world;
    this.#ignoredCollider = ignoredCollider;
    this.#buildingSystem = buildingSystem;
    this.#createProjectileLightPool();
  }

  get selectedWeapon(): WeaponDefinition {
    return WEAPON_DEFINITIONS[this.#selectedSlot] ?? WEAPON_DEFINITIONS[0];
  }

  get selectedWeaponLabel(): string {
    const weapon = this.selectedWeapon;
    return `${weapon.slotLabel} ${weapon.name}`;
  }

  selectSlot(slot: number): boolean {
    const nextSlot = Math.max(0, Math.min(WEAPON_DEFINITIONS.length - 1, slot));
    if (nextSlot === this.#selectedSlot) {
      return false;
    }

    this.#selectedSlot = nextSlot;
    return true;
  }

  update(nowMs: number, deltaSeconds: number): void {
    this.#updateProjectiles(deltaSeconds);
    this.#removeExpiredTemporaryObjects(nowMs);
  }

  tryPrimaryFire(nowMs: number, vectors: CameraVectors, muzzlePosition: Vector3): boolean {
    const weapon = this.selectedWeapon;
    if (nowMs < this.#lastFireAt + weapon.fireIntervalMs) {
      return false;
    }

    this.#lastFireAt = nowMs;
    this.#audio.playShot(weapon);

    const directions = createProjectileDirections(
      vectors.direction,
      weapon.projectileCount,
      weapon.spreadRadians
    );
    for (const direction of directions) {
      this.#spawnProjectile(weapon, direction, muzzlePosition);
    }

    return true;
  }

  #spawnProjectile(weapon: WeaponDefinition, direction: Vector3, muzzlePosition: Vector3): void {
    const position = muzzlePosition.clone().addScaledVector(direction, 1.35);
    const object = createProjectileVisual(weapon.visualKind, direction, weapon.color);
    object.position.copy(position);
    this.#scene.add(object);
    this.#projectiles.push({
      weapon,
      object,
      position,
      direction,
      traveled: 0,
      spin: spinForWeapon(weapon.visualKind),
      ricochetsRemaining: weapon.visualKind === 'ripper' ? RIPPER_RICOCHET_LIMIT : 0,
      lastTrailAt: 0
    });
  }

  #updateProjectiles(deltaSeconds: number): void {
    for (let index = this.#projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.#projectiles[index];
      const previousPosition = projectile.position.clone();
      let remainingDistance = projectile.weapon.speed * deltaSeconds;
      let shouldRemove = false;
      let collisionSteps = 0;

      while (remainingDistance > MIN_STEP_DISTANCE && collisionSteps < MAX_COLLISION_STEPS_PER_FRAME) {
        const hit = this.#castProjectileStep(projectile, remainingDistance);

        if (hit === null) {
          projectile.position.addScaledVector(projectile.direction, remainingDistance);
          projectile.traveled += remainingDistance;
          this.#spawnTrail(projectile, previousPosition, projectile.position);
          remainingDistance = 0;
          continue;
        }

        this.#spawnTrail(projectile, previousPosition, hit.point, true);
        projectile.traveled += hit.distance;
        remainingDistance -= Math.max(hit.distance, MIN_STEP_DISTANCE);

        if (this.#tryRicochet(projectile, hit)) {
          previousPosition.copy(projectile.position);
          collisionSteps += 1;
          continue;
        }

        this.#handleProjectileHit(projectile, hit);
        shouldRemove = true;
        break;
      }

      if (shouldRemove || projectile.traveled >= projectile.weapon.maxDistance) {
        this.#removeProjectile(index);
        continue;
      }

      projectile.object.position.copy(projectile.position);
      projectile.object.rotation.x += projectile.spin.x * deltaSeconds;
      projectile.object.rotation.y += projectile.spin.y * deltaSeconds;
      projectile.object.rotation.z += projectile.spin.z * deltaSeconds;
    }

    this.#updateProjectileLights();
  }

  #castProjectileStep(projectile: ActiveProjectile, distance: number): ProjectileHit | null {
    if (distance <= 0) {
      return null;
    }

    const ray = new RAPIER.Ray(projectile.position, projectile.direction);
    const hit = this.#world.castRayAndGetNormal(
      ray,
      distance,
      true,
      undefined,
      undefined,
      this.#ignoredCollider
    );
    if (hit === null) {
      return null;
    }

    const hitPoint = toVector3(ray.pointAt(hit.timeOfImpact));
    const normal = toVector3(hit.normal).normalize();
    return {
      collider: hit.collider,
      point: hitPoint,
      normal,
      distance: hit.timeOfImpact
    };
  }

  #tryRicochet(projectile: ActiveProjectile, hit: ProjectileHit): boolean {
    if (projectile.weapon.visualKind !== 'ripper' || projectile.ricochetsRemaining <= 0) {
      return false;
    }

    const damagedBuild = this.#buildingSystem.damage(hit.collider, projectile.weapon.damage);
    if (damagedBuild) {
      this.#audio.playImpact(projectile.weapon, 0.24);
      this.#spawnImpact(projectile.weapon, hit.point);
      return false;
    }

    projectile.ricochetsRemaining -= 1;
    projectile.direction.copy(reflectDirection(projectile.direction, hit.normal));
    projectile.position.copy(hit.point).addScaledVector(hit.normal, BOUNCE_SURFACE_NUDGE);
    alignProjectileVisual(projectile.object, projectile.direction);
    this.#audio.playImpact(projectile.weapon, 0.08);
    this.#spawnImpact(projectile.weapon, hit.point);
    return true;
  }

  #handleProjectileHit(projectile: ActiveProjectile, hit: ProjectileHit): void {
    const damagedBuild = this.#buildingSystem.damage(hit.collider, projectile.weapon.damage);
    this.#audio.playImpact(projectile.weapon, damagedBuild ? 0.24 : 0.1);
    this.#spawnImpact(projectile.weapon, hit.point);
  }

  #spawnImpact(weapon: WeaponDefinition, position: Vector3): void {
    const mesh = new Mesh(impactGeometryForRadius(weapon.impactRadius), impactMaterialForColor(weapon.color));
    mesh.position.copy(position);
    this.#scene.add(mesh);
    this.#temporaryObjects.push({
      object: mesh,
      removeAt: performance.now() + IMPACT_REMOVE_AFTER_MS,
      dispose: noop
    });
  }

  #spawnTrail(projectile: ActiveProjectile, start: Vector3, end: Vector3, force = false): void {
    if (start.distanceToSquared(end) <= 0.0001) {
      return;
    }

    const nowMs = performance.now();
    if (!force && nowMs < projectile.lastTrailAt + TRAIL_SPAWN_INTERVAL_MS) {
      return;
    }
    projectile.lastTrailAt = nowMs;

    const geometry = new BufferGeometry().setFromPoints([start, end]);
    const line = new Line(geometry, trailMaterialForColor(projectile.weapon.color));
    this.#scene.add(line);
    this.#temporaryObjects.push({
      object: line,
      removeAt: performance.now() + TRAIL_REMOVE_AFTER_MS,
      dispose: () => {
        geometry.dispose();
      }
    });
  }

  #removeProjectile(index: number): void {
    const [projectile] = this.#projectiles.splice(index, 1);
    this.#scene.remove(projectile.object);
  }

  #removeExpiredTemporaryObjects(nowMs: number): void {
    for (let index = this.#temporaryObjects.length - 1; index >= 0; index -= 1) {
      const item = this.#temporaryObjects[index];
      if (item.removeAt > nowMs) {
        continue;
      }

      this.#scene.remove(item.object);
      item.dispose();
      this.#temporaryObjects.splice(index, 1);
    }
  }

  #createProjectileLightPool(): void {
    for (let index = 0; index < PROJECTILE_LIGHT_POOL_SIZE; index += 1) {
      const light = new PointLight(0xffffff, 0, PROJECTILE_LIGHT_RANGE, PROJECTILE_LIGHT_DECAY);
      light.name = `projectile-light-${String(index)}`;
      this.#projectileLights.push(light);
      this.#scene.add(light);
    }
  }

  #updateProjectileLights(): void {
    for (const light of this.#projectileLights) {
      light.intensity = 0;
    }

    this.#litProjectiles.length = 0;
    this.#litProjectilePriorities.length = 0;
    for (const projectile of this.#projectiles) {
      this.#queueProjectileLightCandidate(projectile, projectileLightPriority(projectile.weapon));
    }

    for (let index = 0; index < this.#litProjectiles.length; index += 1) {
      const projectile = this.#litProjectiles[index];
      const light = this.#projectileLights[index];
      light.color.setHex(projectile.weapon.color);
      light.position.copy(projectile.position);
      light.intensity = PROJECTILE_LIGHT_INTENSITY * this.#litProjectilePriorities[index];
    }
  }

  #queueProjectileLightCandidate(projectile: ActiveProjectile, priority: number): void {
    if (priority <= 0) {
      return;
    }

    let insertAt = this.#litProjectilePriorities.length;
    while (insertAt > 0 && this.#litProjectilePriorities[insertAt - 1] < priority) {
      insertAt -= 1;
    }

    if (insertAt >= this.#projectileLights.length) {
      return;
    }

    this.#litProjectiles.splice(insertAt, 0, projectile);
    this.#litProjectilePriorities.splice(insertAt, 0, priority);
    if (this.#litProjectiles.length > this.#projectileLights.length) {
      this.#litProjectiles.length = this.#projectileLights.length;
      this.#litProjectilePriorities.length = this.#projectileLights.length;
    }
  }
}

function createProjectileDirections(direction: Vector3, count: number, spreadRadians: number): Vector3[] {
  if (count <= 1 || spreadRadians <= 0) {
    return [direction.clone().normalize()];
  }

  const forward = direction.clone().normalize();
  const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize();
  if (right.lengthSq() <= 0.001) {
    right.set(1, 0, 0);
  }
  const up = new Vector3().crossVectors(right, forward).normalize();
  const directions: Vector3[] = [];

  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count;
    const ring = index === 0 ? 0 : spreadRadians;
    const offset = right
      .clone()
      .multiplyScalar(Math.cos(angle) * ring)
      .addScaledVector(up, Math.sin(angle) * ring);
    directions.push(forward.clone().add(offset).normalize());
  }

  return directions;
}

function trailMaterialForColor(color: number): LineBasicMaterial {
  const existing = TRAIL_MATERIAL_CACHE.get(color);
  if (existing !== undefined) {
    return existing;
  }

  const material = new LineBasicMaterial({
    color,
    transparent: true,
    opacity: TRAIL_OPACITY
  });
  TRAIL_MATERIAL_CACHE.set(color, material);
  return material;
}

function impactMaterialForColor(color: number): MeshBasicMaterial {
  const existing = IMPACT_MATERIAL_CACHE.get(color);
  if (existing !== undefined) {
    return existing;
  }

  const material = new MeshBasicMaterial({ color });
  IMPACT_MATERIAL_CACHE.set(color, material);
  return material;
}

function impactGeometryForRadius(radius: number): SphereGeometry {
  const existing = IMPACT_GEOMETRY_CACHE.get(radius);
  if (existing !== undefined) {
    return existing;
  }

  const geometry = new SphereGeometry(radius, 12, 8);
  IMPACT_GEOMETRY_CACHE.set(radius, geometry);
  return geometry;
}

function spinForWeapon(kind: WeaponDefinition['visualKind']): Vector3 {
  if (kind === 'ripper') {
    return new Vector3(0, 0, 34);
  }

  if (kind === 'flak') {
    return new Vector3(14, 6, 9);
  }

  if (kind === 'bio') {
    return new Vector3(3, 5, 2);
  }

  if (kind === 'redeemer') {
    return new Vector3(1.5, 2.5, 1);
  }

  return new Vector3(0, 6, 0);
}

function projectileLightPriority(weapon: WeaponDefinition): number {
  switch (weapon.visualKind) {
    case 'gatling':
      return 0.2;
    case 'flak':
      return 0.28;
    case 'pistol':
      return 0.45;
    case 'sniper':
      return 0.5;
    case 'ripper':
      return 0.78;
    case 'pulse':
      return 0.9;
    case 'shock':
      return 1.15;
    case 'rocket':
      return 1.05;
    case 'bio':
      return 1;
    case 'redeemer':
      return 1.3;
  }
}

function reflectDirection(direction: Vector3, surfaceNormal: Vector3): Vector3 {
  const normal = surfaceNormal.clone().normalize();
  if (direction.dot(normal) > 0) {
    normal.multiplyScalar(-1);
  }

  return direction.clone().sub(normal.multiplyScalar(2 * direction.dot(normal))).normalize();
}

function toVector3(vector: { x: number; y: number; z: number }): Vector3 {
  return new Vector3(vector.x, vector.y, vector.z);
}

function noop(): void {}

class WeaponAudio {
  #context: AudioContext | null = null;

  playShot(weapon: WeaponDefinition): void {
    this.#playTone(shotFrequency(weapon), 0.035, 0.075, 'sawtooth');
    this.#playTone(shotFrequency(weapon) * 2.7, 0.018, 0.03, 'square');
  }

  playImpact(weapon: WeaponDefinition, volume: number): void {
    this.#playTone(Math.max(80, shotFrequency(weapon) * 0.5), 0.045, volume, 'triangle');
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

function shotFrequency(weapon: WeaponDefinition): number {
  return 90 + WEAPON_DEFINITIONS.indexOf(weapon) * 48;
}
