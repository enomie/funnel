/**
 * Death — player and bots share one path.
 *
 * Three layers (same as locomotion — see funnel-locomotion-animations.mdc):
 * 1. Rapier capsule — crouch size (1 m); bottom pinned to floor captured at death
 * 2. `visual.root` — body translation; yaw frozen at death
 * 3. Skinned mesh — per-frame foot anchor with crouch capsule offset (`walking-to-dying`)
 *
 * Locomotion: `walking-to-dying` once when `isDead`.
 */
import type { Collider, RigidBody } from '@dimforge/rapier3d-simd-compat';
import type { Object3D } from 'three/webgpu';
import {
  applyCapsuleMode,
  freezeBodyOnGround,
  inferCapsuleModeFromCollider,
  inferGroundYFromBody,
  meshUsesCrouchCapsule,
  pinBodyCapsuleToGround
} from './humanoid-capsule-sync';
import {
  anchorCharacterMeshFromAnimatedFeet,
  anchorCharacterMeshToStance
} from './player-mesh-foot-anchor';
import type { StanceMeshAnchors } from './player-stance';
import { VERTICAL_JUMP_SUBCLIP_IDS } from './vertical-jump-subclips';

export const HUMANOID_JUMP_FOOT_CLIP_IDS = new Set<string>([
  VERTICAL_JUMP_SUBCLIP_IDS.takeoff,
  VERTICAL_JUMP_SUBCLIP_IDS.land
]);

export interface ActorDeathSnapshot {
  applied: boolean;
  diedAtMs: number;
  frozenYaw: number;
  groundY: number | null;
}

export function createActorDeathSnapshot(): ActorDeathSnapshot {
  return { applied: false, diedAtMs: 0, frozenYaw: 0, groundY: null };
}

export function clearActorDeathSnapshot(snapshot: ActorDeathSnapshot): void {
  snapshot.applied = false;
  snapshot.diedAtMs = 0;
  snapshot.groundY = null;
}

export function syncActorDeathState(
  body: RigidBody,
  collider: Collider,
  snapshot: ActorDeathSnapshot,
  isDead: boolean,
  yaw: number
): void {
  if (!isDead) {
    if (snapshot.applied) {
      applyCapsuleMode(collider, 'stand');
      clearActorDeathSnapshot(snapshot);
    }
    return;
  }

  if (!snapshot.applied) {
    snapshot.applied = true;
    snapshot.diedAtMs = performance.now();
    snapshot.frozenYaw = yaw;
    snapshot.groundY = inferGroundYFromBody(body, inferCapsuleModeFromCollider(collider));
    applyCapsuleMode(collider, 'crouch');
  }

  freezeBodyOnGround(body);
  pinBodyCapsuleToGround(body, snapshot.groundY ?? 0, 'crouch');
}

export function resetActorDeathPhysics(
  body: RigidBody,
  collider: Collider,
  snapshot: ActorDeathSnapshot
): void {
  applyCapsuleMode(collider, 'stand');
  clearActorDeathSnapshot(snapshot);
  freezeBodyOnGround(body);
}

export function actorVisualYaw(snapshot: ActorDeathSnapshot, liveYaw: number): number {
  return snapshot.applied ? snapshot.frozenYaw : liveYaw;
}

export interface FootAnchorState {
  lastClipId: string;
  liveFeetActive: boolean;
}

export function createFootAnchorState(): FootAnchorState {
  return { lastClipId: '', liveFeetActive: false };
}

/** After locomotion mixer tick — player and bots. */
export function syncHumanoidVisualMesh(
  character: Object3D,
  anchors: StanceMeshAnchors,
  isDead: boolean,
  crouching: boolean,
  locomotionClipId: string,
  footAnchor: FootAnchorState
): void {
  const capsuleRoot = character.parent as Object3D;
  const lowCapsule = meshUsesCrouchCapsule(isDead, crouching);
  const needsLiveFeet = isDead || HUMANOID_JUMP_FOOT_CLIP_IDS.has(locomotionClipId);
  const clipChanged = footAnchor.lastClipId !== locomotionClipId;
  footAnchor.lastClipId = locomotionClipId;

  if (needsLiveFeet) {
    if (clipChanged || footAnchor.liveFeetActive) {
      footAnchor.liveFeetActive = true;
      anchorCharacterMeshFromAnimatedFeet(character, capsuleRoot, lowCapsule);
    }
    return;
  }

  footAnchor.liveFeetActive = false;
  anchorCharacterMeshToStance(character, anchors, crouching);
}
