// Path: /Users/johann/MyBrew/funnel-real/src/player/player-team.ts

import {
  DEFAULT_PLAYER_FACTION,
  oppositeFaction,
  relativeTeamRole,
  TEAM_DEFINITIONS,
  type FactionTeam,
  type FactionTeamDefinition,
  type RelativeTeamRole
} from '../combat/teams';

export type TeamChangeReason = 'spawn' | 'hire' | 'dev';

export interface TeamChangeEvent {
  readonly team: FactionTeam;
  readonly previousTeam: FactionTeam;
  readonly reason: TeamChangeReason;
}

export class PlayerTeam {
  #team: FactionTeam = DEFAULT_PLAYER_FACTION;
  readonly #listeners = new Set<(event: TeamChangeEvent) => void>();

  get faction(): FactionTeam {
    return this.#team;
  }

  get definition(): FactionTeamDefinition {
    return TEAM_DEFINITIONS[this.#team];
  }

  
  get localRelativeRole(): RelativeTeamRole {
    return 'ally';
  }

  relativeRole(actorFaction: FactionTeam): RelativeTeamRole {
    return relativeTeamRole(this.#team, actorFaction);
  }

  assign(team: FactionTeam, reason: TeamChangeReason): boolean {
    const previousTeam = this.#team;
    if (team === previousTeam && reason !== 'spawn') {
      return false;
    }

    this.#team = team;
    this.#emit({ team, previousTeam, reason });
    return true;
  }

  
  flip(reason: 'hire' | 'dev'): FactionTeam {
    const next = oppositeFaction(this.#team);
    this.assign(next, reason);
    return next;
  }

  onChange(listener: (event: TeamChangeEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #emit(event: TeamChangeEvent): void {
    for (const listener of this.#listeners) {
      listener(event);
    }
  }
}
