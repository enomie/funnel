import type { Collider, RigidBody } from '@dimforge/rapier3d-simd-compat';
import type { PlayerHealth } from '../player/player-health';
import type { FactionTeam } from './teams';

export type CombatActorKind = 'player' | 'bot';

export const LOCAL_PLAYER_ACTOR_ID = 'local-player';

export interface CombatActor {
  readonly id: string;
  readonly kind: CombatActorKind;
  readonly health: PlayerHealth;
  readonly body: RigidBody;
  readonly colliders: readonly Collider[];
  getFaction(): FactionTeam;
  setFaction(faction: FactionTeam): void;
}

export interface CreateCombatActorOptions {
  id: string;
  kind: CombatActorKind;
  faction: FactionTeam;
  health: PlayerHealth;
  body: RigidBody;
  colliders: readonly Collider[];
}

export function createCombatActor(options: CreateCombatActorOptions): CombatActor {
  let faction = options.faction;

  return {
    id: options.id,
    kind: options.kind,
    health: options.health,
    body: options.body,
    colliders: options.colliders,
    getFaction: () => faction,
    setFaction: (next) => {
      faction = next;
    }
  };
}
