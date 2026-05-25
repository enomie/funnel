import type { PersonalMatchStats } from '../combat/personal-match-stats';
import type { TeamKillScore } from '../combat/team-kill-score';
import type { TeamMatchPoints } from '../combat/team-match-points';
import { oppositeFaction, TEAM_DEFINITIONS, type FactionTeam } from '../combat/teams';
import type { MatchResultOutcome, MatchResultSummary } from './match-result-screen';

function formatPlayerKd(stats: PersonalMatchStats): string {
  if (stats.kills() === 0 && stats.deaths() === 0) {
    return '—';
  }

  return stats.formatKdRatio();
}

export function buildMatchResultSummary(
  viewerFaction: FactionTeam,
  winnerFaction: FactionTeam,
  personalStats: PersonalMatchStats,
  teamKills: TeamKillScore,
  teamPoints: TeamMatchPoints
): MatchResultSummary {
  const enemyFaction = oppositeFaction(viewerFaction);

  return {
    outcome: winnerFaction === viewerFaction ? 'won' : 'lost',
    playerKills: personalStats.kills(),
    playerDeaths: personalStats.deaths(),
    playerKd: formatPlayerKd(personalStats),
    ownTeamLabel: TEAM_DEFINITIONS[viewerFaction].shortLabel,
    ownTeamPoints: teamPoints.formatDisplayPoints(viewerFaction),
    ownTeamKills: teamKills.killsBy(viewerFaction),
    enemyTeamLabel: TEAM_DEFINITIONS[enemyFaction].shortLabel,
    enemyTeamPoints: teamPoints.formatDisplayPoints(enemyFaction),
    enemyTeamKills: teamKills.killsBy(enemyFaction)
  };
}

export type { MatchResultOutcome, MatchResultSummary };
