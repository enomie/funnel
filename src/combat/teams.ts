// Path: /Users/johann/MyBrew/funnel-real/src/combat/teams.ts


import { deriveTeamHex, type RelativeTeamRole } from './team-color-derive';

export type { DerivedTeamColorKind, RelativeTeamRole, TeamUiNuance } from './team-color-derive';
export {
  deriveTeamHex,
  deriveTeamUiHex,
  TEAM_BASE_HEX,
  teamHexToCssHex,
  teamHexToRgb,
  teamHexToRgbString,
  teamRgbaCss
} from './team-color-derive';
export { injectGameTeamCssVars, injectTeamCssVars } from './team-css-vars';

export type FactionTeam = 'alpha' | 'beta';

export const FACTION_TEAMS: readonly FactionTeam[] = ['alpha', 'beta'];

export interface FactionTeamDefinition {
  readonly id: FactionTeam;
  
  readonly label: string;
  readonly shortLabel: string;
  
  readonly spawnZ: number;
}


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
