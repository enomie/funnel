import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Scene
} from 'three/webgpu';
import type { WeaponDefinition } from '../combat/weapon-definitions';
import { PLAYER_CONFIG } from '../config/game-config';
import {
  LocomotionAnimController,
  type LocomotionAnimInput
} from './locomotion-anim-controller';
import { loadShooterPackCharacter } from './shooter-pack-loader';

export class PlayerVisual {
  readonly root = new Group();
  readonly weaponSocket = new Group();
  readonly muzzleSocket = new Group();
  #character: Object3D | null = null;
  #locomotion: LocomotionAnimController | null = null;
  #footOffsetY = 0;
  #weaponMesh: Mesh | null = null;

  constructor(scene: Scene) {
    this.root.name = 'player-visual-root';
    this.weaponSocket.position.set(-0.22, 0.88, -0.48);
    this.weaponSocket.visible = false;
    this.muzzleSocket.position.set(-0.16, 0.84, -1.1);
    this.root.add(this.weaponSocket, this.muzzleSocket);
    scene.add(this.root);
  }

  async load(): Promise<void> {
    const { model, mixer, registry } = await loadShooterPackCharacter();
    this.#configureCharacter(model, new LocomotionAnimController(registry, mixer));
  }

  useFallbackMesh(): void {
    const body = new Mesh(
      new BoxGeometry(0.72, 2.35, 0.5),
      new MeshStandardMaterial({
        color: 0x225dff,
        emissive: 0x0d2d77,
        emissiveIntensity: 0.5,
        roughness: 0.55,
        metalness: 0.35
      })
    );
    body.position.y = -0.05;
    body.castShadow = true;
    body.receiveShadow = true;
    this.root.add(body);
  }

  updateLocomotion(deltaSeconds: number, input: LocomotionAnimInput): void {
    this.#locomotion?.update(deltaSeconds, input);
    this.#anchorCharacterToCapsule();
  }

  setAimVisible(visible: boolean): void {
    this.weaponSocket.visible = visible;
    for (const child of this.root.children) {
      if (child !== this.weaponSocket && child !== this.muzzleSocket) {
        child.visible = !visible;
      }
    }
  }

  setWeapon(weapon: WeaponDefinition): void {
    this.#disposeWeaponMesh();

    const mesh = new Mesh(
      new BoxGeometry(weapon.width, weapon.height, weapon.length),
      new MeshStandardMaterial({
        color: weapon.color,
        emissive: weapon.color,
        emissiveIntensity: 0.16,
        roughness: 0.42,
        metalness: 0.32
      })
    );
    mesh.name = `${weapon.name.toLowerCase().replaceAll(' ', '-')}-bounds`;
    mesh.position.set(0, 0, -weapon.length / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.#weaponMesh = mesh;
    this.weaponSocket.add(mesh);
  }

  #configureCharacter(character: Object3D, locomotion: LocomotionAnimController): void {
    this.#footOffsetY = -(PLAYER_CONFIG.halfHeight + PLAYER_CONFIG.radius);
    character.position.set(0, this.#footOffsetY, 0);
    this.#character = character;
    this.#locomotion = locomotion;

    character.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    this.root.add(character);
  }

  /** Keep skinned mesh at capsule origin — animations must not translate the root. */
  #anchorCharacterToCapsule(): void {
    if (this.#character === null) {
      return;
    }

    this.#character.position.x = 0;
    this.#character.position.z = 0;
    this.#character.position.y = this.#footOffsetY;
    this.#character.rotation.set(0, 0, 0);
  }

  #disposeWeaponMesh(): void {
    if (this.#weaponMesh === null) {
      return;
    }

    this.weaponSocket.remove(this.#weaponMesh);
    this.#weaponMesh.geometry.dispose();
    const materials = Array.isArray(this.#weaponMesh.material)
      ? this.#weaponMesh.material
      : [this.#weaponMesh.material];
    for (const material of materials) {
      material.dispose();
    }
    this.#weaponMesh = null;
  }
}

export type { LocomotionAnimInput };
