// Path: /Users/johann/MyBrew/funnel-real/src/player/humanoid-visual-mount.ts

import {
  AnimationMixer,
  BoxGeometry,
  Mesh,
  MeshStandardMaterial,
  SkinnedMesh,
  type Object3D
} from 'three/webgpu';
import type { AnimationClipRegistry } from './animation-clip-registry';
import { findAnimationRoot } from './animation-clip-registry';
import { LocomotionAnimController } from './locomotion-anim-controller';
import {
  anchorCharacterMeshToStance,
  measureStanceMeshAnchors
} from './player-mesh-foot-anchor';
import type { StanceMeshAnchors } from './player-stance';
import { cloneShooterPackModel } from './shooter-pack-clone';
import type { ShooterPackCharacter } from './shooter-pack-loader';
import { attachHumanoidEyes } from './humanoid-eye-visual';
import { PLAYER_CONFIG } from '../config/game-config';

export const HUMANOID_FALLBACK_MESH_BOTTOM_Y =
  -(PLAYER_CONFIG.halfHeight + PLAYER_CONFIG.radius) - 0.05;

export interface MountedHumanoid {
  readonly character: Object3D;
  readonly locomotion: LocomotionAnimController;
  readonly anchors: StanceMeshAnchors;
}

export interface MountHumanoidCharacterOptions {
  readonly bindAimSpine?: (character: Object3D) => void;
}

export function enableHumanoidCastShadows(root: Object3D): void {
  root.traverse((object) => {
    if (object instanceof Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
}

export function resetHumanoidBindPose(root: Object3D): void {
  root.traverse((object) => {
    if (object instanceof SkinnedMesh) {
      object.skeleton.pose();
    }
  });
}

export function createHumanoidFallbackMesh(
  bottomY = HUMANOID_FALLBACK_MESH_BOTTOM_Y
): Mesh {
  const body = new Mesh(
    new BoxGeometry(0.72, 2.35, 0.5),
    new MeshStandardMaterial({ roughness: 0.55, metalness: 0.35 })
  );
  enableHumanoidCastShadows(body);
  body.position.y = bottomY;
  return body;
}


export function mountHumanoidCharacter(
  root: Object3D,
  model: Object3D,
  registry: AnimationClipRegistry,
  options: MountHumanoidCharacterOptions = {}
): MountedHumanoid {
  const anchors = measureStanceMeshAnchors(model, registry);
  enableHumanoidCastShadows(model);

  const animationRoot = findAnimationRoot(model);
  const forkedRegistry = registry.fork(new AnimationMixer(animationRoot));
  const locomotion = new LocomotionAnimController(forkedRegistry, forkedRegistry.mixer);

  anchorCharacterMeshToStance(model, anchors, false);
  options.bindAimSpine?.(model);
  attachHumanoidEyes(model, 'ally');
  root.add(model);

  return { character: model, locomotion, anchors };
}

export function mountHumanoidFromShooterPack(
  root: Object3D,
  pack: ShooterPackCharacter,
  cloneModel: boolean,
  options: MountHumanoidCharacterOptions = {}
): MountedHumanoid {
  const model = cloneModel ? cloneShooterPackModel(pack.model) : pack.model;
  return mountHumanoidCharacter(root, model, pack.registry, options);
}
