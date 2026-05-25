// Path: /Users/johann/MyBrew/funnel-real/src/combat/team-roster-count.ts

import type { ActorRegistry } from './actor-registry';
import type { CombatActor } from './combat-actor';
import type { FactionTeam } from './teams';

export interface TeamRosterCounts {
  readonly alpha: number;
  readonly beta: number;
}

type MutableTeamRosterCounts = {
  alpha: number;
  beta: number;
};


export class TeamRosterCounter {
  readonly #counts: MutableTeamRosterCounts = { alpha: 0, beta: 0 };
  readonly #livingActorIds = new Set<string>();

  get counts(): TeamRosterCounts {
    return this.#counts;
  }

  rebuild(registry: ActorRegistry): void {
    this.#counts.alpha = 0;
    this.#counts.beta = 0;
    this.#livingActorIds.clear();

    registry.forEachActor((actor) => {
      this.onRegister(actor);
    });
  }

  onRegister(actor: CombatActor): void {
    if (actor.health.isDead || this.#livingActorIds.has(actor.id)) {
      return;
    }

    this.#livingActorIds.add(actor.id);
    this.#counts[actor.getFaction()] += 1;
  }

  onUnregister(actor: CombatActor): void {
    if (!this.#livingActorIds.delete(actor.id)) {
      return;
    }

    this.#counts[actor.getFaction()] -= 1;
  }

  onDeath(actorId: string, faction: FactionTeam): void {
    if (!this.#livingActorIds.delete(actorId)) {
      return;
    }

    this.#counts[faction] -= 1;
  }

  onRevive(actorId: string, faction: FactionTeam): void {
    if (this.#livingActorIds.has(actorId)) {
      return;
    }

    this.#livingActorIds.add(actorId);
    this.#counts[faction] += 1;
  }

  onHired(actorId: string, previousFaction: FactionTeam, newFaction: FactionTeam): void {
    if (previousFaction === newFaction) {
      this.onRevive(actorId, newFaction);
      return;
    }

    if (this.#livingActorIds.has(actorId)) {
      this.onFactionChange(actorId, previousFaction, newFaction);
      return;
    }

    this.onRevive(actorId, newFaction);
  }

  onFactionChange(actorId: string, from: FactionTeam, to: FactionTeam): void {
    if (!this.#livingActorIds.has(actorId)) {
      return;
    }

    this.#counts[from] -= 1;
    this.#counts[to] += 1;
  }
}


export function fillTeamRosterCounts(
  registry: ActorRegistry,
  out: MutableTeamRosterCounts
): TeamRosterCounts {
  out.alpha = 0;
  out.beta = 0;

  registry.forEachActor((actor) => {
    if (actor.health.isDead) {
      return;
    }

    if (actor.getFaction() === 'alpha') {
      out.alpha += 1;
      return;
    }

    out.beta += 1;
  });

  return out;
}


export function countTeamRosterMembers(registry: ActorRegistry): TeamRosterCounts {
  return fillTeamRosterCounts(registry, { alpha: 0, beta: 0 });
}

export function rosterMembersForFaction(
  roster: TeamRosterCounts,
  faction: FactionTeam
): number {
  return roster[faction];
}
