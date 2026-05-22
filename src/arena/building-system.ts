import RAPIER from '@dimforge/rapier3d-simd-compat';
import type { Collider, RigidBody, World } from '@dimforge/rapier3d-simd-compat';
import {
  BoxGeometry,
  ConeGeometry,
  DoubleSide,
  Euler,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Scene,
  Vector3
} from 'three/webgpu';
import { BUILD_CONFIG } from '../config/game-config';
import type { BuildMode } from '../input/input-state';

interface BuildPiece {
  key: string;
  mesh: Mesh;
  body: RigidBody;
  collider: Collider;
  health: number;
}

interface BuildTransform {
  mode: BuildMode;
  key: string;
  position: Vector3;
  rotation: Quaternion;
  halfExtents: Vector3;
  radius: number;
  halfHeight: number;
}

const BUILD_MATERIAL = new MeshStandardMaterial({
  color: 0x6f8793,
  roughness: 0.7,
  metalness: 0.18
});

const PREVIEW_MATERIAL = new MeshStandardMaterial({
  color: 0x8ee6ff,
  emissive: 0x23657c,
  emissiveIntensity: 0.7,
  opacity: 0.48,
  transparent: true,
  side: DoubleSide
});

export class BuildingSystem {
  readonly #scene: Scene;
  readonly #world: World;
  readonly #piecesByCollider = new Map<number, BuildPiece>();
  readonly #occupied = new Map<string, BuildPiece>();
  readonly #preview: Record<BuildMode, Mesh>;
  #activeTransform: BuildTransform | null = null;

  constructor(scene: Scene, world: World) {
    this.#scene = scene;
    this.#world = world;
    this.#preview = {
      wall: this.#createPreviewMesh('wall'),
      floor: this.#createPreviewMesh('floor'),
      ramp: this.#createPreviewMesh('ramp'),
      cone: this.#createPreviewMesh('cone')
    };
  }

  update(playerPosition: Vector3, yaw: number, pitch: number, mode: BuildMode, visible: boolean): void {
    this.#hidePreview();

    if (!visible) {
      this.#activeTransform = null;
      return;
    }

    const transform = this.#computeBuildTransform(playerPosition, yaw, pitch, mode);
    const preview = this.#preview[mode];
    preview.position.copy(transform.position);
    preview.quaternion.copy(transform.rotation);
    preview.visible = !this.#occupied.has(transform.key);
    this.#activeTransform = transform;
  }

  placeActive(): boolean {
    const transform = this.#activeTransform;
    if (transform === null || this.#occupied.has(transform.key)) {
      return false;
    }

    const mesh = this.#createPlacedMesh(transform);
    const bodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(transform.position.x, transform.position.y, transform.position.z)
      .setRotation(transform.rotation);
    const body = this.#world.createRigidBody(bodyDesc);
    const colliderDesc =
      transform.mode === 'cone'
        ? RAPIER.ColliderDesc.cone(transform.halfHeight, transform.radius)
        : RAPIER.ColliderDesc.cuboid(
            transform.halfExtents.x,
            transform.halfExtents.y,
            transform.halfExtents.z
          );

    const collider = this.#world.createCollider(colliderDesc.setFriction(0.85).setRestitution(0), body);
    const piece: BuildPiece = {
      key: transform.key,
      mesh,
      body,
      collider,
      health: BUILD_CONFIG.maxHealth
    };
    this.#piecesByCollider.set(collider.handle, piece);
    this.#occupied.set(transform.key, piece);

    return true;
  }

  damage(collider: Collider, amount: number): boolean {
    const piece = this.#piecesByCollider.get(collider.handle);
    if (piece === undefined) {
      return false;
    }

    piece.health -= amount;
    const healthRatio = Math.max(piece.health / BUILD_CONFIG.maxHealth, 0.18);
    const material = piece.mesh.material;
    if (material instanceof MeshStandardMaterial) {
      material.opacity = healthRatio;
      material.transparent = healthRatio < 1;
      material.emissive.setHex(0x4a150d);
      material.emissiveIntensity = (1 - healthRatio) * 0.8;
    }

    if (piece.health <= 0) {
      this.#destroyPiece(piece);
    }

    return true;
  }

  #destroyPiece(piece: BuildPiece): void {
    this.#scene.remove(piece.mesh);
    piece.mesh.geometry.dispose();
    const materials = Array.isArray(piece.mesh.material) ? piece.mesh.material : [piece.mesh.material];
    for (const material of materials) {
      material.dispose();
    }
    this.#world.removeCollider(piece.collider, true);
    this.#world.removeRigidBody(piece.body);
    this.#piecesByCollider.delete(piece.collider.handle);
    this.#occupied.delete(piece.key);
  }

  #createPreviewMesh(mode: BuildMode): Mesh {
    const mesh = this.#createMeshForMode(mode, PREVIEW_MATERIAL);
    mesh.visible = false;
    this.#scene.add(mesh);
    return mesh;
  }

  #createPlacedMesh(transform: BuildTransform): Mesh {
    const mesh = this.#createMeshForMode(transform.mode, BUILD_MATERIAL.clone());
    mesh.position.copy(transform.position);
    mesh.quaternion.copy(transform.rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.#scene.add(mesh);
    return mesh;
  }

  #createMeshForMode(mode: BuildMode, material: MeshStandardMaterial): Mesh {
    const { grid, storyHeight, wallThickness } = BUILD_CONFIG;

    if (mode === 'wall') {
      return new Mesh(new BoxGeometry(grid, storyHeight, wallThickness), material);
    }

    if (mode === 'floor') {
      return new Mesh(new BoxGeometry(grid, wallThickness, grid), material);
    }

    if (mode === 'ramp') {
      const length = Math.hypot(grid, storyHeight);
      return new Mesh(new BoxGeometry(grid, wallThickness, length), material);
    }

    return new Mesh(new ConeGeometry(grid * 0.48, storyHeight, 4), material);
  }

  #computeBuildTransform(playerPosition: Vector3, yaw: number, pitch: number, mode: BuildMode): BuildTransform {
    const { grid, storyHeight, wallThickness, buildReach } = BUILD_CONFIG;
    const forward = new Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
    const target = playerPosition.clone().addScaledVector(forward, buildReach);
    target.y += Math.tan(pitch) * 2.5;

    const snappedX = snap(target.x, grid) + grid / 2;
    const snappedZ = snap(target.z, grid) + grid / 2;
    const baseY = Math.max(0, snap(target.y, storyHeight));
    const cardinal = Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2);
    const rotation = new Quaternion();
    const halfExtents = new Vector3(grid / 2, storyHeight / 2, wallThickness / 2);
    let position = new Vector3(snappedX, baseY + storyHeight / 2, snappedZ);
    let radius = grid * 0.48;
    let halfHeight = storyHeight / 2;

    if (mode === 'wall') {
      rotation.setFromEuler(new Euler(0, cardinal, 0));
    }

    if (mode === 'floor') {
      position = new Vector3(snappedX, baseY + wallThickness / 2, snappedZ);
      halfExtents.set(grid / 2, wallThickness / 2, grid / 2);
    }

    if (mode === 'ramp') {
      const rampAngle = Math.atan2(storyHeight, grid);
      position = new Vector3(snappedX, baseY + storyHeight / 2, snappedZ);
      rotation.setFromEuler(new Euler(-rampAngle, cardinal, 0));
      halfExtents.set(grid / 2, wallThickness / 2, Math.hypot(grid, storyHeight) / 2);
    }

    if (mode === 'cone') {
      position = new Vector3(snappedX, baseY + storyHeight / 2, snappedZ);
      rotation.setFromEuler(new Euler(0, Math.PI / 4, 0));
      radius = grid * 0.48;
      halfHeight = storyHeight / 2;
      halfExtents.set(radius, halfHeight, radius);
    }

    return {
      mode,
      key: [
        mode,
        String(Math.round(position.x * 10)),
        String(Math.round(position.y * 10)),
        String(Math.round(position.z * 10)),
        String(Math.round(cardinal * 100))
      ].join(':'),
      position,
      rotation,
      halfExtents,
      radius,
      halfHeight
    };
  }

  #hidePreview(): void {
    for (const preview of Object.values(this.#preview)) {
      preview.visible = false;
    }
  }
}

function snap(value: number, size: number): number {
  return Math.floor(value / size) * size;
}
