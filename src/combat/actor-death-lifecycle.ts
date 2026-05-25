// Path: /Users/johann/MyBrew/funnel-real/src/combat/actor-death-lifecycle.ts

import type { GameEventBus } from '../core/event-bus';
import type { ActorDiedEvent } from '../core/game-events';
import { stabilizeCombatAudioAfterDeath } from '../game-audio/combat-world-audio';
import type { WeaponAudio } from '../game-audio/audio-weapon/audio-weapon';
import type { WeaponArsenal } from './weapon-arsenal';
import type { FactionTeam } from './teams';
import type { ProjectileVisualKind } from './weapon-definitions';

export interface ActorDeathCommit {
  readonly actorId: string;
  readonly faction: FactionTeam;
  readonly nowMs: number;
  readonly sourceFaction: FactionTeam;
  readonly sourceActorId?: string;
  readonly sourceWeaponVisualKind?: ProjectileVisualKind;
}

export interface ActorDeathLifecycleDeps {
  readonly bus: GameEventBus;
  readonly weaponAudio: WeaponAudio;
  readonly isLocalPlayer: (actorId: string) => boolean;
  readonly resolveWeapon: (actorId: string) => WeaponArsenal | undefined;
  readonly onActorDeathPhysics: (actorId: string, nowMs: number) => void;
}

export function releaseActorCombatResources(
  weapon: WeaponArsenal | undefined,
  nowMs: number
): void {
  weapon?.suspendCombat(nowMs);
}

export function commitActorDeath(deps: ActorDeathLifecycleDeps, commit: ActorDeathCommit): void {
  deps.onActorDeathPhysics(commit.actorId, commit.nowMs);

  releaseActorCombatResources(deps.resolveWeapon(commit.actorId), commit.nowMs);

  if (deps.isLocalPlayer(commit.actorId)) {
    stabilizeCombatAudioAfterDeath(deps.weaponAudio);
  }

  const event: ActorDiedEvent = {
    actorId: commit.actorId,
    faction: commit.faction,
    sourceFaction: commit.sourceFaction,
    sourceActorId: commit.sourceActorId,
    sourceWeaponVisualKind: commit.sourceWeaponVisualKind,
    nowMs: commit.nowMs
  };
  deps.bus.emit('actor-died', event);
}
