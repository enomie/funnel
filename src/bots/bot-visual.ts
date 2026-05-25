import type { Group, Scene } from 'three/webgpu';
import {
  findBotMuzzleSocket,
  mountWeaponPlaceholderOnCapsuleRoot,
  replaceWeaponPlaceholderOnCapsuleRoot,
  disposeWeaponPlaceholderSocket
} from '../combat/weapon-placeholder-visual';
import type { WeaponDefinition } from '../combat/weapon-definitions';
import type { BotSpawnSlot } from '../combat/match-roster';
import type { FactionTeam } from '../combat/teams';
import type { LocomotionAnimInput } from '../player/locomotion-anim-controller';
import { HumanoidVisual } from '../player/humanoid-visual';
import { PlayerAimSpine } from '../player/player-aim-spine';
import type { ShooterPackCharacter } from '../player/shooter-pack-loader';
import type { PlayerTeam } from '../player/player-team';
import { applyRelativeTeamColors } from '../player/team-visual-colors';

export class BotVisual {
  readonly #humanoid: HumanoidVisual;
  readonly #aimSpine = new PlayerAimSpine();
  readonly faction: FactionTeam;
  #weaponSocket: Group;
  #muzzleSocket: Group;

  constructor(
    scene: Scene,
    slot: BotSpawnSlot,
    viewerTeam: PlayerTeam,
    template: ShooterPackCharacter | undefined,
    weapon: WeaponDefinition
  ) {
    this.faction = slot.faction;
    this.#humanoid = new HumanoidVisual(
      template === undefined ? `bot-fallback-${slot.faction}` : `bot-${slot.faction}`,
      scene
    );

    if (template === undefined) {
      this.#humanoid.mountFallback();
    } else {
      this.#humanoid.mountShooterPack(template, true, {
        bindAimSpine: (character) => {
          this.#aimSpine.bind(character);
        }
      });
    }

    this.#weaponSocket = mountWeaponPlaceholderOnCapsuleRoot(this.root, weapon);
    this.#muzzleSocket = findBotMuzzleSocket(this.root) ?? this.#weaponSocket;
    this.applyViewerColors(viewerTeam);
  }

  get root(): Group {
    return this.#humanoid.root;
  }

  get weaponSocket(): Group {
    return this.#weaponSocket;
  }

  get muzzleSocket(): Group {
    return this.#muzzleSocket;
  }

  get locomotionClipId(): string {
    return this.#humanoid.locomotionClipId;
  }

  equipWeapon(weapon: WeaponDefinition): void {
    this.#weaponSocket = replaceWeaponPlaceholderOnCapsuleRoot(this.root, weapon);
    this.#muzzleSocket = findBotMuzzleSocket(this.root) ?? this.#weaponSocket;
  }

  applyViewerColors(viewerTeam: PlayerTeam): void {
    const role = viewerTeam.relativeRole(this.faction);
    this.#humanoid.setTeamRole(role);
    applyRelativeTeamColors(this.root, role);
  }

  flashDamage(nowMs?: number): void {
    this.#humanoid.flashDamage(nowMs);
  }

  syncTransform(x: number, y: number, z: number, yaw: number): void {
    this.#humanoid.syncTransform(x, y, z, yaw);
  }

  updateLocomotion(
    deltaSeconds: number,
    input: LocomotionAnimInput,
    aimPitch: number,
    skipAnimation = false,
    nowMs?: number
  ): void {
    this.#humanoid.updateLocomotion(deltaSeconds, input, nowMs, skipAnimation);
    if (input.isDead || skipAnimation) {
      if (input.isDead) {
        this.#weaponSocket.rotation.x = 0;
      }
      return;
    }

    this.#aimSpine.apply(aimPitch, 1, this.#weaponSocket);
    this.#humanoid.syncEyesFromHead();
  }

  reviveLocomotion(): void {
    this.#humanoid.reviveLocomotion();
  }

  dispose(): void {
    disposeWeaponPlaceholderSocket(this.#weaponSocket);
    this.#humanoid.dispose();
  }
}
