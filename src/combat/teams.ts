/** Faction identity — two opposing sides in the funnel (intro §5, §8). */
import { deriveTeamHex, type RelativeTeamRole } from './team-color-derive';

export type { DerivedTeamColorKind, RelativeTeamRole } from './team-color-derive';
export { deriveTeamHex, TEAM_BASE_HEX } from './team-color-derive';

export type FactionTeam = 'alpha' | 'beta';

export const FACTION_TEAMS: readonly FactionTeam[] = ['alpha', 'beta'];

export interface FactionTeamDefinition {
  readonly id: FactionTeam;
  /** HUD / scoreboard label, e.g. "Team Alpha". */
  readonly label: string;
  readonly shortLabel: string;
  /** Spawn anchor along funnel Z (opposing tunnel ends). */
  readonly spawnZ: number;
}

/** Pocket center Z — all spawns live in the 15 m strip behind shield rows. */
export const TEAM_DEFINITIONS: Record<FactionTeam, FactionTeamDefinition> = {
  alpha: {
    id: 'alpha',
    label: 'Team Alpha',
    shortLabel: 'Alpha',
    spawnZ: -142.5
  },
  beta: {
    id: 'beta',
    label: 'Team Beta',
    shortLabel: 'Beta',
    spawnZ: 142.5
  }
};

export const DEFAULT_PLAYER_FACTION: FactionTeam = 'beta';

/** Default segment tint — see `applyRelativeTeamColors` for joint vs segment split. */
export const RELATIVE_TEAM_COLORS = {
  ally: {
    color: deriveTeamHex('ally'),
    emissive: deriveTeamHex('ally', 'emissiveDim'),
    emissiveIntensity: 0.18
  },
  enemy: {
    color: deriveTeamHex('enemy'),
    emissive: deriveTeamHex('enemy', 'emissiveDim'),
    emissiveIntensity: 0.18
  }
} as const;

export function areSameFaction(a: FactionTeam, b: FactionTeam): boolean {
  return a === b;
}

export function relativeTeamRole(
  viewerFaction: FactionTeam,
  actorFaction: FactionTeam
): RelativeTeamRole {
  return areSameFaction(viewerFaction, actorFaction) ? 'ally' : 'enemy';
}

export function oppositeFaction(team: FactionTeam): FactionTeam {
  return team === 'alpha' ? 'beta' : 'alpha';
}
