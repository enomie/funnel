// Path: /Users/johann/MyBrew/funnel-real/src/ui/team-hud.ts

import type { TeamKillScore } from '../combat/team-kill-score';
import type { TeamMatchPoints } from '../combat/team-match-points';
import { rosterMembersForFaction, type TeamRosterCounts } from '../combat/team-roster-count';
import { oppositeFaction, TEAM_DEFINITIONS, type FactionTeam } from '../combat/teams';

export interface TeamHudNodes {
  ownBadge: HTMLDivElement;
  ownLabel: HTMLSpanElement;
  ownMembers: HTMLSpanElement;
  ownKills: HTMLSpanElement;
  ownPoints: HTMLSpanElement;
  enemyBadge: HTMLDivElement;
  enemyLabel: HTMLSpanElement;
  enemyMembers: HTMLSpanElement;
  enemyKills: HTMLSpanElement;
  enemyPoints: HTMLSpanElement;
}

export class TeamHud {
  readonly #ownLabel: HTMLSpanElement;
  readonly #ownMembers: HTMLSpanElement;
  readonly #ownKills: HTMLSpanElement;
  readonly #ownPoints: HTMLSpanElement;
  readonly #ownBadge: HTMLDivElement;
  readonly #enemyLabel: HTMLSpanElement;
  readonly #enemyMembers: HTMLSpanElement;
  readonly #enemyKills: HTMLSpanElement;
  readonly #enemyPoints: HTMLSpanElement;
  readonly #enemyBadge: HTMLDivElement;

  constructor(nodes: TeamHudNodes) {
    this.#ownBadge = nodes.ownBadge;
    this.#ownLabel = nodes.ownLabel;
    this.#ownMembers = nodes.ownMembers;
    this.#ownKills = nodes.ownKills;
    this.#ownPoints = nodes.ownPoints;
    this.#enemyBadge = nodes.enemyBadge;
    this.#enemyLabel = nodes.enemyLabel;
    this.#enemyMembers = nodes.enemyMembers;
    this.#enemyKills = nodes.enemyKills;
    this.#enemyPoints = nodes.enemyPoints;
  }

  update(
    viewerFaction: FactionTeam,
    scores: TeamKillScore,
    roster: TeamRosterCounts,
    points: TeamMatchPoints
  ): void {
    const enemyFaction = oppositeFaction(viewerFaction);
    const ownTeam = TEAM_DEFINITIONS[viewerFaction];
    const enemyTeam = TEAM_DEFINITIONS[enemyFaction];
    const winner = points.winner;

    this.#ownBadge.dataset.team = viewerFaction;
    this.#ownBadge.dataset.winner = winner === viewerFaction ? 'true' : 'false';
    this.#ownLabel.textContent = ownTeam.label;
    this.#ownMembers.textContent = String(rosterMembersForFaction(roster, viewerFaction));
    this.#ownKills.textContent = String(scores.killsBy(viewerFaction));
    this.#ownPoints.textContent = points.formatDisplayPoints(viewerFaction);

    this.#enemyBadge.dataset.team = enemyFaction;
    this.#enemyBadge.dataset.winner = winner === enemyFaction ? 'true' : 'false';
    this.#enemyLabel.textContent = enemyTeam.label;
    this.#enemyMembers.textContent = String(rosterMembersForFaction(roster, enemyFaction));
    this.#enemyKills.textContent = String(scores.killsBy(enemyFaction));
    this.#enemyPoints.textContent = points.formatDisplayPoints(enemyFaction);
  }
}
