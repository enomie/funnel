import { Color } from 'three/webgpu';

/** One hex per viewer-relative role — all tints computed from this (intro §8). */
export const TEAM_BASE_HEX = {
  ally: 0x225dff,
  enemy: 0xd42b2b
} as const;

export type RelativeTeamRole = keyof typeof TEAM_BASE_HEX;

const HSL = { h: 0, s: 0, l: 0 };

/** HSL multipliers from `TEAM_BASE_HEX` — tune only here. */
const DERIVE = {
  /** Suit albedo (identity). */
  base: null,
  /** Segment-Glow — kräftigere Teamfarbe, ohne aufzuhellen. */
  emissiveDim: { satMul: 0.9, lightMul: 0.26 },
  /** Gelenk-Glow — volle Sättigung, Helligkeit gedeckelt (nicht weiß). */
  emissiveGlow: { satMul: 1, lightMul: 0.94, lightCap: 0.44 },
  /** Badges, dezente UI. */
  muted: { satMul: 0.5, lightMul: 0.22 },
  /** Trim zwischen base und bright. */
  trim: { satMul: 0.82, lightMul: 1.1, lightCap: 0.65 }
} as const;

export type DerivedTeamColorKind = keyof typeof DERIVE;

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
