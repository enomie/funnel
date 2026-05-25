// Path: /Users/johann/MyBrew/funnel-real/src/core/game-events.ts

import type { FactionTeam } from '../combat/teams';
import type { ProjectileVisualKind } from '../combat/weapon-definitions';

export interface ActorDamagedEvent {
  readonly actorId: string;
  readonly amount: number;
  readonly remaining: number;
  readonly remainingShield: number;
  readonly sourceFaction: FactionTeam;
  readonly sourceActorId?: string;
  readonly sourceWeaponVisualKind?: ProjectileVisualKind;
  readonly nowMs: number;
}

export interface ActorDiedEvent {
  readonly actorId: string;
  readonly faction: FactionTeam;
  readonly sourceFaction: FactionTeam;
  readonly sourceActorId?: string;
  readonly sourceWeaponVisualKind?: ProjectileVisualKind;
  readonly nowMs: number;
}

export interface ActorRespawnedEvent {
  readonly actorId: string;
  readonly faction: FactionTeam;
}

export interface ActorRevivedEvent {
  readonly actorId: string;
  readonly faction: FactionTeam;
  readonly reviverId: string;
}

export interface ActorHiredEvent {
  readonly actorId: string;
  readonly previousFaction: FactionTeam;
  readonly newFaction: FactionTeam;
  readonly hirerId: string;
}

export interface GameEventMap {
  'actor-damaged': ActorDamagedEvent;
  'actor-died': ActorDiedEvent;
  'actor-respawned': ActorRespawnedEvent;
  'actor-revived': ActorRevivedEvent;
  'actor-hired': ActorHiredEvent;
}

export type GameEventName = keyof GameEventMap;
