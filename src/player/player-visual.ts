// Path: /Users/johann/MyBrew/funnel-real/src/player/player-visual.ts

import { Group, Scene, Vector3 } from 'three/webgpu';
import { detachSceneObject } from '../render/dispose-three';
import {
  applyWeaponPlaceholderToSocket,
  firstPersonMuzzleSocketPosition,
  thirdPersonMuzzleSocketPosition,
  THIRD_PERSON_WEAPON_SOCKET_POSITION
} from '../combat/weapon-placeholder-visual';
import { WEAPON_DEFINITIONS, type WeaponDefinition } from '../combat/weapon-definitions';
import { PLAYER_CONFIG } from '../config/game-config';
import { DEFAULT_HUMANOID_RIG, type HumanoidRigId } from './humanoid-rig';
import type { LocomotionAnimInput } from './locomotion-anim-controller';
import { HumanoidVisual } from './humanoid-visual';
import { loadShooterPackCharacter, type ShooterPackCharacter } from './shooter-pack-loader';
import { PlayerAimSpine } from './player-aim-spine';
import { applyRelativeTeamColors } from './team-visual-colors';


const THIRD_PERSON_CROUCH_WEAPON_DROP_Y =
  PLAYER_CONFIG.cameraHeight - PLAYER_CONFIG.crouchCameraHeight;

export class PlayerVisual {
  readonly #humanoid: HumanoidVisual;
  readonly weaponSocket = new Group();
  readonly muzzleSocket = new Group();
  readonly #aimSpine = new PlayerAimSpine();
  #weaponMesh: Group | null = null;
  #activeWeapon: WeaponDefinition = WEAPON_DEFINITIONS[0];
  #rigId: HumanoidRigId = DEFAULT_HUMANOID_RIG;
  #lastFirstPersonVisible = false;
  #lastCrouchWeaponStance = false;

  constructor(scene: Scene) {
    this.#humanoid = new HumanoidVisual('player-visual-root', scene);
    this.weaponSocket.position.copy(THIRD_PERSON_WEAPON_SOCKET_POSITION);
    this.muzzleSocket.position.copy(thirdPersonMuzzleSocketPosition(this.#activeWeapon));
    this.weaponSocket.add(this.muzzleSocket);
    this.root.add(this.weaponSocket);
  }

  get root(): Group {
    return this.#humanoid.root;
  }

  get rigId(): HumanoidRigId {
    return this.#rigId;
  }

  async load(): Promise<void> {
    this.mountShooterPack(await loadShooterPackCharacter());
  }

  mountShooterPack(pack: ShooterPackCharacter): void {
    this.#rigId = pack.rigId;
    this.#humanoid.mountShooterPack(pack, false, {
      bindAimSpine: (character) => {
        this.#aimSpine.bind(character);
      }
    });
    this.applyLocalAllyColors();
  }

  useFallbackMesh(): void {
    this.#humanoid.mountFallback();
    this.applyLocalAllyColors();
  }

  applyLocalAllyColors(): void {
    this.#humanoid.setTeamRole('ally');
    applyRelativeTeamColors(this.root, 'ally');
  }

  flashDamage(nowMs: number): void {
    this.#humanoid.flashDamage(nowMs);
  }

  updateLocomotion(deltaSeconds: number, input: LocomotionAnimInput, nowMs: number): void {
    this.#humanoid.updateLocomotion(deltaSeconds, input, nowMs);
  }

  reviveLocomotion(): void {
    this.#humanoid.reviveLocomotion();
  }

  syncThirdPersonWeaponStance(crouching: boolean, firstPersonBlend: number): void {
    if (firstPersonBlend > 0.5 || this.weaponSocket.parent !== this.root) {
      return;
    }

    if (crouching === this.#lastCrouchWeaponStance) {
      return;
    }

    this.#lastCrouchWeaponStance = crouching;
    const drop = crouching ? THIRD_PERSON_CROUCH_WEAPON_DROP_Y : 0;
    this.weaponSocket.position.set(
      THIRD_PERSON_WEAPON_SOCKET_POSITION.x,
      THIRD_PERSON_WEAPON_SOCKET_POSITION.y - drop,
      THIRD_PERSON_WEAPON_SOCKET_POSITION.z
    );
  }

  get locomotionClipId(): string {
    return this.#humanoid.locomotionClipId;
  }

  updateCameraPresentation(firstPersonBlend: number): void {
    const firstPerson = firstPersonBlend > 0.55;
    if (firstPerson === this.#lastFirstPersonVisible) {
      return;
    }

    this.#lastFirstPersonVisible = firstPerson;
    const character = this.#humanoid.character;
    if (character !== null) {
      character.visible = !firstPerson;
    }
    for (const child of this.root.children) {
      if (child === this.weaponSocket || child === this.muzzleSocket || child === character) {
        continue;
      }
      child.visible = !firstPerson;
    }
  }

  updateAimSpine(pitch: number, thirdPersonBlend: number, isDead: boolean): void {
    if (isDead) {
      this.weaponSocket.rotation.x = 0;
      return;
    }

    const tpBlend = 1 - Math.min(1, Math.max(0, thirdPersonBlend));
    this.#aimSpine.apply(pitch, tpBlend, this.weaponSocket);
    if (tpBlend > 0.01) {
      this.#humanoid.syncEyesFromHead();
    }
  }

  setWeapon(weapon: WeaponDefinition): void {
    this.#activeWeapon = weapon;
    this.#disposeWeaponMesh();
    this.#weaponMesh = applyWeaponPlaceholderToSocket(
      this.weaponSocket,
      weapon,
      this.muzzleSocket
    );
  }

  muzzleOffsetThirdPerson(): Vector3 {
    return thirdPersonMuzzleSocketPosition(this.#activeWeapon);
  }

  muzzleOffsetFirstPerson(): Vector3 {
    return firstPersonMuzzleSocketPosition(this.#activeWeapon);
  }

  #disposeWeaponMesh(): void {
    if (this.#weaponMesh === null) {
      return;
    }

    detachSceneObject(this.#weaponMesh, { disposeSubtree: true });
    this.#weaponMesh = null;
  }
}

export type { LocomotionAnimInput };
