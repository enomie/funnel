// Path: /Users/johann/MyBrew/funnel-real/src/combat/revive-hire-channel.ts

import type { RigidBody } from '@dimforge/rapier3d-simd-compat';
import {
  clearReviveHireChannelState,
  effectiveRespawnElapsedMs,
  endRespawnPause,
  startRespawnPause,
  type ActorDeathSnapshot,
  type ReviveHireChannelMode
} from '../player/actor-death';
import { PLAYER_AUTO_RESPAWN_MS } from '../player/player-auto-respawn';
import type { DownedActorIndex } from './downed-actor-index';
import type { CombatActor } from './combat-actor';
import {
  HIRE_CHANNEL_SECONDS,
  REVIVE_CHANNEL_SECONDS,
  REVIVE_HIRE_PROXIMITY_SQ,
  REVIVE_HIRE_Y_SLOP_M
} from './revive-hire-config';
import type { FactionTeam } from './teams';

export interface ReviveHireHudView {
  readonly visible: boolean;
  readonly mode: ReviveHireChannelMode | null;
  readonly progress: number;
}

export interface ReviveHireChannelComplete {
  readonly mode: ReviveHireChannelMode;
  readonly targetActorId: string;
  readonly targetActor: CombatActor;
  readonly targetSnapshot: ActorDeathSnapshot;
}

export interface ReviveHireChannelDeps {
  readonly channelerId: string;
  getChannelerFaction: () => FactionTeam;
  readonly downedIndex: DownedActorIndex;
  readonly channelerBody: RigidBody;
  isChannelerEligible: () => boolean;
  onComplete: (result: ReviveHireChannelComplete) => void;
}

const IDLE_HUD: ReviveHireHudView = { visible: false, mode: null, progress: 0 };

interface MutableReviveHireHudView {
  visible: boolean;
  mode: ReviveHireChannelMode | null;
  progress: number;
}

const _spectatorHudScratch: MutableReviveHireHudView = { visible: true, mode: null, progress: 0 };

export class ReviveHireChannel {
  #targetActorId: string | null = null;
  #targetActor: CombatActor | null = null;
  #targetSnapshot: ActorDeathSnapshot | null = null;
  #mode: ReviveHireChannelMode | null = null;
  #progress = 0;
  #durationSeconds = REVIVE_CHANNEL_SECONDS;
  #hudView: MutableReviveHireHudView = { visible: false, mode: null, progress: 0 };

  get isChanneling(): boolean {
    return this.#targetActorId !== null;
  }

  get hudView(): ReviveHireHudView {
    return this.#hudView;
  }

  mayTick(
    matchLive: boolean,
    downedCount: number,
    reviveChannelHeld: boolean,
    spectatorSnapshot: ActorDeathSnapshot | null
  ): boolean {
    if (!matchLive) {
      return false;
    }

    if (
      downedCount === 0 &&
      !this.isChanneling &&
      (spectatorSnapshot === null || spectatorSnapshot.channelerId === null) &&
      !reviveChannelHeld
    ) {
      return false;
    }

    if (!reviveChannelHeld && !this.isChanneling) {
      if (spectatorSnapshot !== null && spectatorSnapshot.channelerId !== null) {
        return true;
      }

      return false;
    }

    return true;
  }

  tick(
    deps: ReviveHireChannelDeps,
    reviveChannelHeld: boolean,
    nowMs: number,
    deltaSeconds: number,
    spectatorSnapshot: ActorDeathSnapshot | null
  ): ReviveHireHudView {
    if (
      spectatorSnapshot !== null &&
      spectatorSnapshot.channelerId !== null &&
      spectatorSnapshot.channelMode !== null &&
      !this.isChanneling
    ) {
      this.#setHudVisible(spectatorSnapshot.channelMode, spectatorSnapshot.channelProgress);
      return this.#hudView;
    }

    if (!deps.isChannelerEligible()) {
      if (this.isChanneling) {
        this.#abortActive(nowMs);
      }

      this.#setHudIdle();
      return this.#hudView;
    }

    if (this.isChanneling) {
      return this.#tickActiveChannel(deps, reviveChannelHeld, nowMs, deltaSeconds);
    }

    if (!reviveChannelHeld) {
      this.#setHudIdle();
      return this.#hudView;
    }

    const picked = pickNearestDownedTarget(deps, nowMs);
    if (picked === null) {
      this.#setHudIdle();
      return this.#hudView;
    }

    this.#beginChannel(deps.channelerId, picked.mode, picked.entry, nowMs);
    return this.#tickActiveChannel(deps, reviveChannelHeld, nowMs, deltaSeconds);
  }

  abortAll(nowMs: number): void {
    if (this.isChanneling) {
      this.#abortActive(nowMs);
    }

    this.#setHudIdle();
  }

  #beginChannel(
    channelerId: string,
    mode: ReviveHireChannelMode,
    entry: { actorId: string; actor: CombatActor; deathSnapshot: ActorDeathSnapshot },
    nowMs: number
  ): void {
    this.#targetActorId = entry.actorId;
    this.#targetActor = entry.actor;
    this.#targetSnapshot = entry.deathSnapshot;
    this.#mode = mode;
    this.#progress = 0;
    this.#durationSeconds = mode === 'revive' ? REVIVE_CHANNEL_SECONDS : HIRE_CHANNEL_SECONDS;
    entry.deathSnapshot.channelerId = channelerId;
    entry.deathSnapshot.channelMode = mode;
    entry.deathSnapshot.channelProgress = 0;
    startRespawnPause(entry.deathSnapshot, nowMs);
  }

  #tickActiveChannel(
    deps: ReviveHireChannelDeps,
    reviveChannelHeld: boolean,
    nowMs: number,
    deltaSeconds: number
  ): ReviveHireHudView {
    const targetSnapshot = this.#targetSnapshot;
    const targetActorId = this.#targetActorId;
    const targetActor = this.#targetActor;
    const mode = this.#mode;
    if (targetSnapshot === null || targetActorId === null || targetActor === null || mode === null) {
      this.#setHudIdle();
      return this.#hudView;
    }

    const channelValid =
      reviveChannelHeld &&
      isDownedActorEligible(targetActor.health.isDead, targetSnapshot, nowMs) &&
      isWithinReviveHireRange(deps.channelerBody, targetActor.body);

    if (!channelValid) {
      this.#abortActive(nowMs);
      this.#setHudIdle();
      return this.#hudView;
    }

    this.#progress += deltaSeconds;
    const progress01 = Math.min(1, this.#progress / this.#durationSeconds);
    targetSnapshot.channelProgress = progress01;
    this.#setHudVisible(mode, progress01);

    if (progress01 >= 1) {
      deps.onComplete({
        mode,
        targetActorId,
        targetActor,
        targetSnapshot
      });
      this.#clearLocalChannel();
      this.#setHudIdle();
    }

    return this.#hudView;
  }

  #abortActive(nowMs: number): void {
    const targetSnapshot = this.#targetSnapshot;
    if (targetSnapshot !== null) {
      endRespawnPause(targetSnapshot, nowMs);
      clearReviveHireChannelState(targetSnapshot);
    }

    this.#clearLocalChannel();
  }

  #clearLocalChannel(): void {
    this.#targetActorId = null;
    this.#targetActor = null;
    this.#targetSnapshot = null;
    this.#mode = null;
    this.#progress = 0;
  }

  #setHudIdle(): void {
    this.#hudView.visible = false;
    this.#hudView.mode = null;
    this.#hudView.progress = 0;
  }

  #setHudVisible(mode: ReviveHireChannelMode, progress: number): void {
    this.#hudView.visible = true;
    this.#hudView.mode = mode;
    this.#hudView.progress = progress;
  }
}

function isDownedWindowOpen(nowMs: number, snapshot: ActorDeathSnapshot): boolean {
  if (!snapshot.applied && snapshot.diedAtMs <= 0) {
    return false;
  }

  return effectiveRespawnElapsedMs(nowMs, snapshot) < PLAYER_AUTO_RESPAWN_MS;
}

function isDownedActorEligible(
  isDead: boolean,
  snapshot: ActorDeathSnapshot,
  nowMs: number
): boolean {
  if (!isDead) {
    return false;
  }

  if (!snapshot.applied && snapshot.diedAtMs <= 0) {
    return false;
  }

  return isDownedWindowOpen(nowMs, snapshot);
}

function isWithinReviveHireRange(channelerBody: RigidBody, targetBody: RigidBody): boolean {
  const channeler = channelerBody.translation();
  const target = targetBody.translation();
  const dx = target.x - channeler.x;
  const dy = target.y - channeler.y;
  const dz = target.z - channeler.z;

  if (Math.abs(dy) > REVIVE_HIRE_Y_SLOP_M) {
    return false;
  }

  return dx * dx + dz * dz <= REVIVE_HIRE_PROXIMITY_SQ;
}

function pickNearestDownedTarget(
  deps: ReviveHireChannelDeps,
  nowMs: number
): {
  mode: ReviveHireChannelMode;
  entry: { actorId: string; actor: CombatActor; deathSnapshot: ActorDeathSnapshot };
} | null {
  const channeler = deps.channelerBody.translation();
  let bestDistSq = Infinity;
  let bestEntry: {
    actorId: string;
    actor: CombatActor;
    deathSnapshot: ActorDeathSnapshot;
  } | null = null;
  let bestMode: ReviveHireChannelMode | null = null;

  for (let index = 0; index < deps.downedIndex.count; index += 1) {
    const entry = deps.downedIndex.entryAt(index);
    const snapshot = entry.deathSnapshot;
    if (!isDownedActorEligible(entry.actor.health.isDead, snapshot, nowMs)) {
      continue;
    }

    if (snapshot.channelerId !== null && snapshot.channelerId !== deps.channelerId) {
      continue;
    }

    if (!isWithinReviveHireRange(deps.channelerBody, entry.actor.body)) {
      continue;
    }

    const target = entry.actor.body.translation();
    const dx = target.x - channeler.x;
    const dz = target.z - channeler.z;
    const distSq = dx * dx + dz * dz;
    if (distSq >= bestDistSq) {
      continue;
    }

    const mode: ReviveHireChannelMode =
      entry.actor.getFaction() === deps.getChannelerFaction() ? 'revive' : 'hire';
    bestDistSq = distSq;
    bestEntry = entry;
    bestMode = mode;
  }

  if (bestEntry === null || bestMode === null) {
    return null;
  }

  return { mode: bestMode, entry: bestEntry };
}

export function readSpectatorReviveHireHud(
  snapshot: ActorDeathSnapshot | null
): ReviveHireHudView {
  if (snapshot === null || snapshot.channelerId === null || snapshot.channelMode === null) {
    return IDLE_HUD;
  }

  _spectatorHudScratch.mode = snapshot.channelMode;
  _spectatorHudScratch.progress = snapshot.channelProgress;
  return _spectatorHudScratch;
}
