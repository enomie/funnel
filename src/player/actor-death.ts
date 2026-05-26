// Path: /Users/johann/MyBrew/funnel-real/src/player/actor-death.ts


import type { Collider, RigidBody } from '@dimforge/rapier3d-simd-compat';
import type { Object3D } from 'three/webgpu';
import {
  applyCapsuleMode,
  freezeBodyOnGround,
  inferCapsuleModeFromCollider,
  inferGroundYFromBody,
  meshUsesCrouchCapsule,
  pinBodyCapsuleAt,
  transitionCapsuleAt
} from './humanoid-capsule-sync';
import {
  anchorCharacterMeshFromAnimatedFeet,
  anchorCharacterMeshToStance
} from './player-mesh-foot-anchor';
import type { StanceMeshAnchors } from './player-stance';
import { VERTICAL_JUMP_SUBCLIP_IDS } from './vertical-jump-subclips';

export const STANDING_UP_CLIP_ID = 'standing-up';

export const HUMANOID_JUMP_FOOT_CLIP_IDS = new Set<string>([
  VERTICAL_JUMP_SUBCLIP_IDS.takeoff,
  VERTICAL_JUMP_SUBCLIP_IDS.land,
  STANDING_UP_CLIP_ID
]);

export type ReviveHireChannelMode = 'revive' | 'hire';

export interface HumanoidGroundAnchor {
  groundY: number;
  x: number;
  z: number;
}

export interface ActorDeathSnapshot {
  applied: boolean;
  diedAtMs: number;
  frozenYaw: number;
  frozenX: number;
  frozenZ: number;
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
    frozenX: 0,
    frozenZ: 0,
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
  snapshot.frozenYaw = 0;
  snapshot.frozenX = 0;
  snapshot.frozenZ = 0;
  snapshot.groundY = null;
  snapshot.respawnPauseAccumMs = 0;
  snapshot.respawnPauseStartedMs = 0;
  snapshot.channelerId = null;
  snapshot.channelMode = null;
  snapshot.channelProgress = 0;
}

export function effectiveRespawnElapsedMs(nowMs: number, snapshot: ActorDeathSnapshot): number {
  if (snapshot.diedAtMs <= 0) {
    return 0;
  }

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
  yaw: number,
  nowMs: number
): void {
  if (!isDead) {
    if (snapshot.applied) {
      applyCapsuleMode(collider, 'stand');
      clearActorDeathSnapshot(snapshot);
    }
    return;
  }

  if (!snapshot.applied) {
    const translation = body.translation();
    snapshot.applied = true;
    snapshot.diedAtMs = nowMs;
    snapshot.frozenYaw = yaw;
    snapshot.frozenX = translation.x;
    snapshot.frozenZ = translation.z;
    snapshot.groundY = inferGroundYFromBody(body, inferCapsuleModeFromCollider(collider));
    applyCapsuleMode(collider, 'crouch');
  }

  freezeBodyOnGround(body);
  pinBodyCapsuleAt(
    body,
    snapshot.groundY ?? 0,
    snapshot.frozenX,
    snapshot.frozenZ,
    'crouch'
  );
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

export function beginReviveInPlacePhysics(
  body: RigidBody,
  collider: Collider,
  snapshot: ActorDeathSnapshot
): HumanoidGroundAnchor {
  const translation = body.translation();
  const anchor: HumanoidGroundAnchor = {
    groundY:
      snapshot.groundY ??
      inferGroundYFromBody(body, inferCapsuleModeFromCollider(collider)),
    x: snapshot.applied ? snapshot.frozenX : translation.x,
    z: snapshot.applied ? snapshot.frozenZ : translation.z
  };
  clearActorDeathSnapshot(snapshot);
  applyCapsuleMode(collider, 'crouch');
  pinBodyCapsuleAt(body, anchor.groundY, anchor.x, anchor.z, 'crouch');
  freezeBodyOnGround(body);
  return anchor;
}

export function finishReviveInPlacePhysics(
  body: RigidBody,
  collider: Collider,
  anchor: HumanoidGroundAnchor
): void {
  transitionCapsuleAt({
    collider,
    body,
    toMode: 'stand',
    groundY: anchor.groundY,
    x: anchor.x,
    z: anchor.z
  });
  freezeBodyOnGround(body);
}

export function maintainReviveStandUpPhysics(
  body: RigidBody,
  anchor: HumanoidGroundAnchor
): void {
  freezeBodyOnGround(body);
  pinBodyCapsuleAt(body, anchor.groundY, anchor.x, anchor.z, 'crouch');
}

export function actorVisualYaw(snapshot: ActorDeathSnapshot, liveYaw: number): number {
  return snapshot.applied ? snapshot.frozenYaw : liveYaw;
}

export interface FootAnchorState {
  lastClipId: string;
  liveFeetActive: boolean;
  liveFeetTick: number;
}

export function createFootAnchorState(): FootAnchorState {
  return { lastClipId: '', liveFeetActive: false, liveFeetTick: 0 };
}

const LIVE_FEET_ANCHOR_INTERVAL = 2;


export function syncHumanoidVisualMesh(
  character: Object3D,
  anchors: StanceMeshAnchors,
  isDead: boolean,
  crouching: boolean,
  locomotionClipId: string,
  footAnchor: FootAnchorState
): void {
  const capsuleRoot = character.parent as Object3D;
  const lowCapsule =
    meshUsesCrouchCapsule(isDead, crouching) || locomotionClipId === STANDING_UP_CLIP_ID;
  const needsLiveFeet = isDead || HUMANOID_JUMP_FOOT_CLIP_IDS.has(locomotionClipId);
  const clipChanged = footAnchor.lastClipId !== locomotionClipId;
  footAnchor.lastClipId = locomotionClipId;

  if (needsLiveFeet) {
    footAnchor.liveFeetTick += 1;
    const shouldRefreshLiveFeet =
      clipChanged ||
      !footAnchor.liveFeetActive ||
      footAnchor.liveFeetTick % LIVE_FEET_ANCHOR_INTERVAL === 0;
    if (shouldRefreshLiveFeet) {
      footAnchor.liveFeetActive = true;
      anchorCharacterMeshFromAnimatedFeet(character, capsuleRoot, lowCapsule);
    }
    return;
  }

  footAnchor.liveFeetTick = 0;
  footAnchor.liveFeetActive = false;
  anchorCharacterMeshToStance(character, anchors, crouching);
}
