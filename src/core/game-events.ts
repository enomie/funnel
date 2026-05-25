import type { FactionTeam } from '../combat/teams';

export interface ActorDamagedEvent {
  readonly actorId: string;
  readonly amount: number;
  readonly remaining: number;
  readonly remainingShield: number;
  readonly sourceFaction: FactionTeam;
  readonly sourceActorId?: string;
}

export interface ActorDiedEvent {
  readonly actorId: string;
  readonly faction: FactionTeam;
  /** Faction that dealt the killing blow (cross-faction only). */
  readonly sourceFaction: FactionTeam;
  readonly sourceActorId?: string;
}

export interface ActorRespawnedEvent {
  readonly actorId: string;
  readonly faction: FactionTeam;
}

export interface GameEventMap {
  'actor-damaged': ActorDamagedEvent;
  'actor-died': ActorDiedEvent;
  'actor-respawned': ActorRespawnedEvent;
}

export type GameEventName = keyof GameEventMap;
