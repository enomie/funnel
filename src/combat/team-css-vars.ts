// Path: /Users/johann/MyBrew/funnel-real/src/combat/team-css-vars.ts

import {
  deriveTeamHex,
  deriveTeamUiHex,
  teamHexToCssHex,
  teamHexToRgbString,
  teamRgbaCss
} from './team-color-derive';

/** Shared ally/enemy palette — sourced from {@link TEAM_BASE_HEX}. */
export function injectTeamCssVars(root: HTMLElement = document.documentElement): void {
  const allyBase = deriveTeamHex('ally');
  const enemyBase = deriveTeamHex('enemy');
  const allyMuted = deriveTeamUiHex('ally', 'muted');
  const allySoft = deriveTeamUiHex('ally', 'soft');
  const enemyMuted = deriveTeamUiHex('enemy', 'muted');
  const enemySoft = deriveTeamUiHex('enemy', 'soft');
  const enemyBright = deriveTeamUiHex('enemy', 'bright');

  const set = (name: string, value: string): void => {
    root.style.setProperty(name, value);
  };

  set('--funnel-team-ally', teamHexToCssHex(allyBase));
  set('--funnel-team-ally-rgb', teamHexToRgbString(allyBase));
  set('--funnel-team-ally-muted', teamHexToCssHex(allyMuted));
  set('--funnel-team-ally-soft', teamHexToCssHex(allySoft));
  set('--funnel-team-ally-glow', teamRgbaCss(allyBase, 0.42));

  set('--funnel-team-enemy', teamHexToCssHex(enemyBase));
  set('--funnel-team-enemy-rgb', teamHexToRgbString(enemyBase));
  set('--funnel-team-enemy-muted', teamHexToCssHex(enemyMuted));
  set('--funnel-team-enemy-soft', teamHexToCssHex(enemySoft));
  set('--funnel-team-enemy-bright', teamHexToCssHex(enemyBright));
  set('--funnel-team-enemy-glow', teamRgbaCss(enemyBase, 0.42));
}

/** Game shell extras (prematch grid, danger scrim) on top of {@link injectTeamCssVars}. */
export function injectGameTeamCssVars(root: HTMLElement = document.documentElement): void {
  injectTeamCssVars(root);

  const allyBase = deriveTeamHex('ally');
  const enemyBright = deriveTeamUiHex('enemy', 'bright');

  root.style.setProperty('--funnel-grid-line-minor', teamRgbaCss(allyBase, 0.28));
  root.style.setProperty('--funnel-grid-line-major', teamRgbaCss(allyBase, 0.55));
  root.style.setProperty('--funnel-overlay-scrim-danger-center', teamRgbaCss(enemyBright, 0.12));
}
