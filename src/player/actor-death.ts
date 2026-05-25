// Path: /Users/johann/MyBrew/funnel-real/src/player/actor-death.ts


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

export type ReviveHireChannelMode = 'revive' | 'hire';

export interface ActorDeathSnapshot {
  applied: boolean;
  diedAtMs: number;
  frozenYaw: number;
  groundY: number | null;
  respawnPauseAccumMs: number;
  respawnPauseStartedMs: number;
  channelerId: string | null;
  channelMode: ReviveHireChannelMode | null;
  channelProgress: number;
}

export function createActorDeathSnapshot(): ActorDeathSnapshot {
  return {
    applied: false,
    diedAtMs: 0,
    frozenYaw: 0,
    groundY: null,
    respawnPauseAccumMs: 0,
    respawnPauseStartedMs: 0,
    channelerId: null,
    channelMode: null,
    channelProgress: 0
  };
}

export function clearActorDeathSnapshot(snapshot: ActorDeathSnapshot): void {
  snapshot.applied = false;
  snapshot.diedAtMs = 0;
  snapshot.groundY = null;
  snapshot.respawnPauseAccumMs = 0;
  snapshot.respawnPauseStartedMs = 0;
  snapshot.channelerId = null;
  snapshot.channelMode = null;
  snapshot.channelProgress = 0;
}

export function effectiveRespawnElapsedMs(nowMs: number, snapshot: ActorDeathSnapshot): number {
  let pauseMs = snapshot.respawnPauseAccumMs;
  if (snapshot.respawnPauseStartedMs > 0) {
    pauseMs += nowMs - snapshot.respawnPauseStartedMs;
  }

  return nowMs - snapshot.diedAtMs - pauseMs;
}

export function startRespawnPause(snapshot: ActorDeathSnapshot, nowMs: number): void {
  if (snapshot.respawnPauseStartedMs <= 0) {
    snapshot.respawnPauseStartedMs = nowMs;
  }
}

export function endRespawnPause(snapshot: ActorDeathSnapshot, nowMs: number): void {
  if (snapshot.respawnPauseStartedMs <= 0) {
    return;
  }

  snapshot.respawnPauseAccumMs += nowMs - snapshot.respawnPauseStartedMs;
  snapshot.respawnPauseStartedMs = 0;
}

export function clearReviveHireChannelState(snapshot: ActorDeathSnapshot): void {
  snapshot.channelerId = null;
  snapshot.channelMode = null;
  snapshot.channelProgress = 0;
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
