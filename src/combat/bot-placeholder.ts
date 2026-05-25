import {
  AnimationMixer,
  BoxGeometry,
  Group,
  LoopRepeat,
  Mesh,
  MeshStandardMaterial,
  type Scene
} from 'three/webgpu';
import { PLAYER_CONFIG } from '../config/game-config';
import { findAnimationRoot } from '../player/animation-clip-registry';
import { cloneShooterPackModel } from '../player/shooter-pack-clone';
import type { ShooterPackCharacter } from '../player/shooter-pack-loader';
import type { PlayerTeam } from '../player/player-team';
import { applyRelativeTeamColors } from '../player/team-visual-colors';
import { rollSpawnWeapon } from './spawn-weapon-roll';
import {
  mountWeaponPlaceholderOnCapsuleRoot
} from './weapon-placeholder-visual';
import type { BotSpawnSlot } from './match-roster';
import type { FactionTeam } from './teams';

const IDLE_CLIP_ID = 'rifle-aiming-idle';

export class BotPlaceholder {
  readonly root = new Group();
  readonly faction: FactionTeam;
  readonly #mixer: AnimationMixer | null;

  constructor(
    scene: Scene,
    slot: BotSpawnSlot,
    viewerTeam: PlayerTeam,
    template?: ShooterPackCharacter
  ) {
    this.faction = slot.faction;
    this.root.name =
      template === undefined ? `bot-fallback-${slot.faction}` : `bot-${slot.faction}`;
    this.root.position.set(slot.x, slot.y, slot.z);
    this.root.rotation.y = slot.yaw;

    if (template === undefined) {
      this.#mixer = null;
      this.#mountFallbackBody();
    } else {
      this.#mixer = this.#mountCharacter(template);
    }

    mountWeaponPlaceholderOnCapsuleRoot(this.root, rollSpawnWeapon());

    scene.add(this.root);
    this.applyViewerColors(viewerTeam);
  }

  applyViewerColors(viewerTeam: PlayerTeam): void {
    applyRelativeTeamColors(this.root, viewerTeam.relativeRole(this.faction));
  }

  update(deltaSeconds: number): void {
    this.#mixer?.update(deltaSeconds);
  }

  #mountCharacter(template: ShooterPackCharacter): AnimationMixer {
    const model = cloneShooterPackModel(template.model);
    const footOffsetY = -(PLAYER_CONFIG.halfHeight + PLAYER_CONFIG.radius);
    model.position.set(0, footOffsetY, 0);

    model.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    const animationRoot = findAnimationRoot(model);
    const mixer = new AnimationMixer(animationRoot);
    const registry = template.registry.fork(mixer);
    const idle = registry.getAction(IDLE_CLIP_ID);
    if (idle !== undefined) {
      idle.setLoop(LoopRepeat, Infinity);
      idle.reset().fadeIn(0.15).play();
    }

    this.root.add(model);
    return mixer;
  }

  #mountFallbackBody(): void {
    const body = new Mesh(
      new BoxGeometry(0.72, 2.35, 0.5),
      new MeshStandardMaterial({ roughness: 0.55, metalness: 0.35 })
    );
    body.position.y = -(PLAYER_CONFIG.halfHeight + PLAYER_CONFIG.radius) - 0.05;
    body.castShadow = true;
    body.receiveShadow = true;
    this.root.add(body);
  }
}
