// Path: /Users/johann/MyBrew/funnel-real/src/player/humanoid-visual.ts

import { Group, type Mesh, type Object3D, type Scene } from 'three/webgpu';
import { detachSceneObject } from '../render/dispose-three';
import { syncHumanoidVisualMesh, createFootAnchorState } from './actor-death';
import type { LocomotionAnimInput } from './locomotion-anim-controller';
import { LocomotionAnimController } from './locomotion-anim-controller';
import { anchorCharacterMeshToStance } from './player-mesh-foot-anchor';
import type { StanceMeshAnchors } from './player-stance';
import type { ShooterPackCharacter } from './shooter-pack-loader';
import type { RelativeTeamRole } from '../combat/team-color-derive';
import { DAMAGE_HIT_FLASH_MS } from '../combat/damage-feedback';
import { isPooledTeamMaterial, setJointHitFlash } from './team-visual-colors';
import {
  createHeadBoneEyeSyncGate,
  resetHeadBoneEyeSyncGate,
  shouldSyncHumanoidEyes,
  syncHumanoidEyes,
  type HeadBoneEyeSyncGate
} from './humanoid-eye-visual';
import {
  createHumanoidFallbackMesh,
  HUMANOID_FALLBACK_MESH_BOTTOM_Y,
  type MountHumanoidCharacterOptions,
  mountHumanoidFromShooterPack,
  type MountedHumanoid
} from './humanoid-visual-mount';

const FALLBACK_MESH_ANCHORS: StanceMeshAnchors = { standFootY: 0, crouchFootY: 0 };


export class HumanoidVisual {
  readonly root = new Group();
  #character: Object3D | null = null;
  #locomotion: LocomotionAnimController | null = null;
  #fallbackBody: Mesh | null = null;
  #meshAnchors: StanceMeshAnchors = FALLBACK_MESH_ANCHORS;
  readonly #footAnchor = createFootAnchorState();
  #flashUntilMs = 0;
  #jointFlashActive = false;
  #teamRole: RelativeTeamRole = 'ally';
  readonly #eyeSyncGate: HeadBoneEyeSyncGate = createHeadBoneEyeSyncGate();

  constructor(rootName: string, scene?: Scene) {
    this.root.name = rootName;
    scene?.add(this.root);
  }

  get character(): Object3D | null {
    return this.#character;
  }

  get locomotionClipId(): string {
    return this.#locomotion?.currentClipId ?? 'rifle-aiming-idle';
  }

  get standingUpActive(): boolean {
    return this.#locomotion?.standingUpActive ?? false;
  }

  get meshAnchors(): StanceMeshAnchors {
    return this.#meshAnchors;
  }

  mountShooterPack(
    pack: ShooterPackCharacter,
    cloneModel: boolean,
    options: MountHumanoidCharacterOptions = {}
  ): void {
    this.#applyMount(mountHumanoidFromShooterPack(this.root, pack, cloneModel, options));
  }

  mountFallback(bottomY = HUMANOID_FALLBACK_MESH_BOTTOM_Y): void {
    this.#fallbackBody = createHumanoidFallbackMesh(bottomY);
    this.root.add(this.#fallbackBody);
  }

  updateLocomotion(
    deltaSeconds: number,
    input: LocomotionAnimInput,
    nowMs: number,
    visualReduced = false
  ): void {
    const flashNowMs = nowMs;

    this.#locomotion?.update(deltaSeconds, input);

    if (this.#locomotion?.deathPoseSettled) {
      this.#tickJointFlash(flashNowMs, input.isDead);
      return;
    }

    if (!visualReduced) {
      this.#syncMesh(input.isDead, input.crouch || input.sliding);
      if (
        this.#character !== null &&
        shouldSyncHumanoidEyes(this.#character, this.locomotionClipId, this.#eyeSyncGate)
      ) {
        syncHumanoidEyes(this.#character);
      }
    }

    this.#tickJointFlash(flashNowMs, input.isDead);
  }

  syncEyesFromHead(): void {
    if (this.#character !== null) {
      syncHumanoidEyes(this.#character);
    }
  }

  setTeamRole(role: RelativeTeamRole): void {
    this.#teamRole = role;
  }

  flashDamage(nowMs: number): void {
    this.#flashUntilMs = nowMs + DAMAGE_HIT_FLASH_MS;
    if (this.#character !== null) {
      setJointHitFlash(this.#character, this.#teamRole, true);
      this.#jointFlashActive = true;
    }
  }

  #tickJointFlash(nowMs: number, isDead: boolean): void {
    if (isDead || !this.#jointFlashActive || this.#character === null || nowMs < this.#flashUntilMs) {
      return;
    }

    setJointHitFlash(this.#character, this.#teamRole, false);
    this.#jointFlashActive = false;
  }

  #clearJointFlash(): void {
    if (this.#jointFlashActive && this.#character !== null) {
      setJointHitFlash(this.#character, this.#teamRole, false);
    }
    this.#flashUntilMs = 0;
    this.#jointFlashActive = false;
  }

  reviveLocomotion(standUp = false): void {
    if (standUp) {
      this.#locomotion?.playStandingUpRevive();
      this.#footAnchor.lastClipId = '';
      this.#footAnchor.liveFeetActive = true;
    } else {
      this.#locomotion?.reviveToIdle();
      if (this.#character !== null) {
        anchorCharacterMeshToStance(this.#character, this.#meshAnchors, false);
      } else if (this.#fallbackBody !== null) {
        this.#fallbackBody.position.y = HUMANOID_FALLBACK_MESH_BOTTOM_Y;
      }
    }

    resetHeadBoneEyeSyncGate(this.#eyeSyncGate);
    this.#clearJointFlash();
  }

  syncTransform(x: number, y: number, z: number, yaw: number): void {
    this.root.position.set(x, y, z);
    this.root.rotation.y = yaw;
  }

  
  dispose(): void {
    this.#clearJointFlash();
    if (this.#character !== null) {
      detachSceneObject(this.#character, {
        disposeSubtree: true,
        shouldDisposeMaterial: (material) => !isPooledTeamMaterial(material)
      });
      this.#character = null;
      this.#locomotion = null;
    }

    if (this.#fallbackBody !== null) {
      detachSceneObject(this.#fallbackBody, { disposeSubtree: true });
      this.#fallbackBody = null;
    }

    this.root.removeFromParent();
  }

  #applyMount(mounted: MountedHumanoid): void {
    this.#flashUntilMs = 0;
    this.#jointFlashActive = false;
    resetHeadBoneEyeSyncGate(this.#eyeSyncGate);
    this.#character = mounted.character;
    this.#locomotion = mounted.locomotion;
    this.#meshAnchors = mounted.anchors;
  }

  #syncMesh(isDead: boolean, crouching: boolean): void {
    if (this.#character !== null) {
      syncHumanoidVisualMesh(
        this.#character,
        this.#meshAnchors,
        isDead,
        crouching,
        this.locomotionClipId,
        this.#footAnchor
      );
      return;
    }

    if (this.#fallbackBody !== null) {
      this.#fallbackBody.position.y = HUMANOID_FALLBACK_MESH_BOTTOM_Y;
    }
  }
}
