// Path: /Users/johann/MyBrew/funnel-real/src/combat/team-color-derive.ts

import { Color } from 'three/webgpu';


/** Viewer-relative ally (blue) and enemy (red) — single source for 3D + HUD. */
export const TEAM_BASE_HEX = {
  ally: 0x225dff,
  enemy: 0xd42b2b
} as const;

export type RelativeTeamRole = keyof typeof TEAM_BASE_HEX;

const HSL = { h: 0, s: 0, l: 0 };


const DERIVE = {
  
  base: null,
  
  emissiveDim: { satMul: 0.9, lightMul: 0.26 },
  
  emissiveGlow: { satMul: 1, lightMul: 0.94, lightCap: 0.44 },
  
  muted: { satMul: 0.5, lightMul: 0.22 },
  
  trim: { satMul: 0.82, lightMul: 1.1, lightCap: 0.65 }
} as const;

export type DerivedTeamColorKind = keyof typeof DERIVE;

type TeamUiHsl = { readonly hShift: number; readonly s: number; readonly l: number };

function teamUiFromBase(role: RelativeTeamRole, nuance: TeamUiHsl): number {
  const color = new Color(TEAM_BASE_HEX[role]);
  color.getHSL(HSL);
  let hue = HSL.h + nuance.hShift;
  if (hue < 0) {
    hue += 1;
  } else if (hue > 1) {
    hue -= 1;
  }
  color.setHSL(hue, nuance.s, nuance.l);
  return color.getHex();
}

export const TEAM_UI_HEX = {
  ally: {
    muted: teamUiFromBase('ally', { hShift: -0.044, s: 1, l: 0.671 }),
    soft: teamUiFromBase('ally', { hShift: -0.042, s: 1, l: 0.74 })
  },
  enemy: {
    muted: teamUiFromBase('enemy', { hShift: 0, s: 1, l: 0.662 }),
    soft: teamUiFromBase('enemy', { hShift: 0.007, s: 1, l: 0.554 }),
    bright: teamUiFromBase('enemy', { hShift: 0.004, s: 1, l: 0.523 })
  }
} as const;

export type TeamUiNuance = 'muted' | 'soft' | 'bright';

export function deriveTeamHex(
  role: RelativeTeamRole,
  kind: DerivedTeamColorKind = 'base'
): number {
  const base = TEAM_BASE_HEX[role];
  const params = DERIVE[kind];
  if (params === null) {
    return base;
  }

  const color = new Color(base);
  color.getHSL(HSL);
  const lightCap = 'lightCap' in params ? params.lightCap : 1;
  color.setHSL(
    HSL.h,
    Math.min(1, HSL.s * params.satMul),
    Math.min(lightCap, HSL.l * params.lightMul)
  );
  return color.getHex();
}

export function deriveTeamUiHex(role: RelativeTeamRole, nuance: TeamUiNuance): number {
  if (role === 'ally') {
    if (nuance === 'bright') {
      return deriveTeamHex(role);
    }
    return TEAM_UI_HEX.ally[nuance];
  }
  return TEAM_UI_HEX.enemy[nuance];
}

export function teamHexToCssHex(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

export function teamHexToRgb(hex: number): readonly [number, number, number] {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255] as const;
}

export function teamHexToRgbString(hex: number): string {
  const [r, g, b] = teamHexToRgb(hex);
  return `${r.toString()}, ${g.toString()}, ${b.toString()}`;
}

export function teamRgbaCss(hex: number, alpha: number): string {
  const [r, g, b] = teamHexToRgb(hex);
  return `rgba(${r.toString()}, ${g.toString()}, ${b.toString()}, ${alpha.toString()})`;
}
