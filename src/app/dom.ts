// Path: /Users/johann/MyBrew/funnel-real/src/app/dom.ts

import { PICKUP_FIELD_CONFIG } from '../config/game-config';
import { FUNNEL_GAME_BRAND_MARKUP } from '../ui/funnel-game-brand';

export interface AppDom {
  preMatchHost: HTMLDivElement;
  canvas: HTMLCanvasElement;
  shell: HTMLDivElement;
  hud: HTMLDivElement;
  status: HTMLDivElement;
  personalStatsHud: HTMLDivElement;
  personalStatsKills: HTMLSpanElement;
  personalStatsDeaths: HTMLSpanElement;
  personalStatsKdRatio: HTMLSpanElement;
  teamOwnBadge: HTMLDivElement;
  teamOwnLabel: HTMLSpanElement;
  teamOwnMembers: HTMLSpanElement;
  teamOwnKills: HTMLSpanElement;
  teamOwnPoints: HTMLSpanElement;
  teamEnemyBadge: HTMLDivElement;
  teamEnemyLabel: HTMLSpanElement;
  teamEnemyMembers: HTMLSpanElement;
  teamEnemyKills: HTMLSpanElement;
  teamEnemyPoints: HTMLSpanElement;
  ammoHud: HTMLDivElement;
  ammoTitle: HTMLSpanElement;
  ammoCount: HTMLSpanElement;
  ammoMagazine: HTMLDivElement;
  ammoReloadFill: HTMLDivElement;
  weaponBar: HTMLDivElement;
  healthHud: HTMLDivElement;
  shieldFill: HTMLDivElement;
  healthFill: HTMLDivElement;
  crosshair: HTMLDivElement;
  damageVignette: HTMLDivElement;
  fpsHud: HTMLDivElement;
  fpsValue: HTMLSpanElement;
  fpsCanvas: HTMLCanvasElement;
}

export function createAppDom(root: HTMLDivElement): AppDom {
  root.textContent = '';
  document.documentElement.style.setProperty(
    '--funnel-shield-color',
    hexColorToCss(PICKUP_FIELD_CONFIG.shield.color)
  );

  const preMatchHost = document.createElement('div');
  preMatchHost.className = 'funnel-prematch-host';

  const shell = document.createElement('div');
  shell.className = 'funnel-shell';
  shell.hidden = true;

  const canvas = document.createElement('canvas');
  canvas.className = 'funnel-canvas';
  canvas.tabIndex = 0;

  const hud = document.createElement('div');
  hud.className = 'funnel-hud';
  hud.innerHTML = `
    <div class="funnel-damage-vignette" aria-hidden="true"></div>
    <div class="funnel-crosshair" aria-hidden="true">
      <span class="funnel-crosshair__line funnel-crosshair__line--tl"></span>
      <span class="funnel-crosshair__line funnel-crosshair__line--tr"></span>
      <span class="funnel-crosshair__line funnel-crosshair__line--bl"></span>
      <span class="funnel-crosshair__line funnel-crosshair__line--br"></span>
    </div>
    <div class="funnel-team-scoreboard-stack">
      ${FUNNEL_GAME_BRAND_MARKUP}
      <div class="funnel-team-scoreboard" aria-label="Team scores">
      <div class="funnel-team-badge funnel-team-badge--own" data-role="ally">
        <div class="funnel-team-badge__head">
          <span class="funnel-team-badge__label">Team Beta</span>
        </div>
        <div class="funnel-team-badge__metrics">
          <div class="funnel-team-badge__metric">
            <span class="funnel-team-badge__members" aria-label="Team members">0</span>
            <span class="funnel-team-badge__metric-label">Members</span>
          </div>
          <div class="funnel-team-badge__metric">
            <span class="funnel-team-badge__kills" aria-label="Team kills">0</span>
            <span class="funnel-team-badge__metric-label">Kills</span>
          </div>
          <div class="funnel-team-badge__metric">
            <span class="funnel-team-badge__points" aria-label="Team points">000</span>
            <span class="funnel-team-badge__metric-label">Points</span>
          </div>
        </div>
      </div>
      <div class="funnel-team-badge funnel-team-badge--enemy" data-role="enemy">
        <div class="funnel-team-badge__head">
          <span class="funnel-team-badge__label">Team Alpha</span>
        </div>
        <div class="funnel-team-badge__metrics">
          <div class="funnel-team-badge__metric">
            <span class="funnel-team-badge__members" aria-label="Team members">0</span>
            <span class="funnel-team-badge__metric-label">Members</span>
          </div>
          <div class="funnel-team-badge__metric">
            <span class="funnel-team-badge__kills" aria-label="Team kills">0</span>
            <span class="funnel-team-badge__metric-label">Kills</span>
          </div>
          <div class="funnel-team-badge__metric">
            <span class="funnel-team-badge__points" aria-label="Team points">000</span>
            <span class="funnel-team-badge__metric-label">Points</span>
          </div>
        </div>
      </div>
    </div>
    </div>
    <div class="funnel-hud-panel funnel-health" aria-label="Player health and shield">
      <div class="funnel-hud-panel__head funnel-health__head">
        <span class="funnel-hud-panel__title">Vitals</span>
      </div>
      <div class="funnel-hud-panel__body funnel-health__body">
        <div class="funnel-stat-row">
          <span class="funnel-stat-row__label funnel-stat-row__label--health">HP</span>
          <div class="funnel-stat-row__track">
            <div class="funnel-health__fill funnel-stat-row__fill"></div>
          </div>
        </div>
        <div class="funnel-stat-row">
          <span class="funnel-stat-row__label funnel-stat-row__label--shield">SH</span>
          <div class="funnel-stat-row__track">
            <div class="funnel-shield__fill funnel-stat-row__fill"></div>
          </div>
        </div>
      </div>
    </div>
    <div class="funnel-weapon-bar" aria-label="Weapon selection" hidden>
      <div class="funnel-weapon-bar__slots"></div>
    </div>
    <div class="funnel-hud-panel funnel-ammo" aria-label="Weapon ammunition" hidden>
      <div class="funnel-hud-panel__head funnel-ammo__head">
        <span class="funnel-hud-panel__title funnel-ammo__title"></span>
      </div>
      <div class="funnel-hud-panel__body funnel-ammo__body">
        <div class="funnel-stat-row">
          <span class="funnel-stat-row__label funnel-stat-row__label--numeric funnel-ammo__count">0</span>
          <div class="funnel-stat-row__track">
            <div class="funnel-ammo__mag"></div>
          </div>
        </div>
        <div class="funnel-stat-row">
          <span class="funnel-stat-row__label">Reload</span>
          <div class="funnel-stat-row__track">
            <div class="funnel-ammo__reload-fill funnel-stat-row__fill"></div>
          </div>
        </div>
      </div>
    </div>
    <div class="funnel-personal-stats" aria-label="Player match stats">
      <div class="funnel-personal-stats__head">
        <span class="funnel-personal-stats__title">Stats</span>
      </div>
      <div class="funnel-personal-stats__metrics">
        <div class="funnel-personal-stats__metric funnel-personal-stats__metric--kills">
          <span class="funnel-personal-stats__value funnel-personal-stats__kills">0</span>
          <span class="funnel-personal-stats__label">Kills</span>
        </div>
        <div class="funnel-personal-stats__metric funnel-personal-stats__metric--deaths">
          <span class="funnel-personal-stats__value funnel-personal-stats__deaths">0</span>
          <span class="funnel-personal-stats__label">Death</span>
        </div>
        <div class="funnel-personal-stats__metric funnel-personal-stats__metric--ratio">
          <span class="funnel-personal-stats__value funnel-personal-stats__kd">-</span>
          <span class="funnel-personal-stats__label">Ratio</span>
        </div>
      </div>
    </div>
    <div class="funnel-fps-hud" aria-label="Frames per second">
      <div class="funnel-fps-hud__head">
        <span class="funnel-fps-hud__title">FPS</span>
      </div>
      <div class="funnel-fps-hud__body">
        <div class="funnel-fps-hud__metric">
          <span class="funnel-fps-hud__value">0</span>
        </div>
        <canvas class="funnel-fps-hud__graph" width="128" height="28" aria-hidden="true"></canvas>
      </div>
    </div>
  `;

  const status = document.createElement('div');
  status.className = 'funnel-status';
  status.dataset.visible = 'false';
  const personalStatsHud = hud.querySelector<HTMLDivElement>('.funnel-personal-stats');
  const personalStatsKills = hud.querySelector<HTMLSpanElement>('.funnel-personal-stats__kills');
  const personalStatsDeaths = hud.querySelector<HTMLSpanElement>('.funnel-personal-stats__deaths');
  const personalStatsKdRatio = hud.querySelector<HTMLSpanElement>('.funnel-personal-stats__kd');
  const teamOwnBadge = hud.querySelector<HTMLDivElement>('.funnel-team-badge--own');
  const teamOwnLabel = hud.querySelector<HTMLSpanElement>('.funnel-team-badge--own .funnel-team-badge__label');
  const teamOwnKills = hud.querySelector<HTMLSpanElement>('.funnel-team-badge--own .funnel-team-badge__kills');
  const teamOwnPoints = hud.querySelector<HTMLSpanElement>(
    '.funnel-team-badge--own .funnel-team-badge__points'
  );
  const teamOwnMembers = hud.querySelector<HTMLSpanElement>(
    '.funnel-team-badge--own .funnel-team-badge__members'
  );
  const teamEnemyBadge = hud.querySelector<HTMLDivElement>('.funnel-team-badge--enemy');
  const teamEnemyLabel = hud.querySelector<HTMLSpanElement>(
    '.funnel-team-badge--enemy .funnel-team-badge__label'
  );
  const teamEnemyKills = hud.querySelector<HTMLSpanElement>(
    '.funnel-team-badge--enemy .funnel-team-badge__kills'
  );
  const teamEnemyPoints = hud.querySelector<HTMLSpanElement>(
    '.funnel-team-badge--enemy .funnel-team-badge__points'
  );
  const teamEnemyMembers = hud.querySelector<HTMLSpanElement>(
    '.funnel-team-badge--enemy .funnel-team-badge__members'
  );
  if (
    personalStatsHud === null ||
    personalStatsKills === null ||
    personalStatsDeaths === null ||
    personalStatsKdRatio === null
  ) {
    throw new Error('FUNNEL personal stats HUD nodes were not created.');
  }
  if (
    teamOwnBadge === null ||
    teamOwnLabel === null ||
    teamOwnMembers === null ||
    teamOwnKills === null ||
    teamOwnPoints === null ||
    teamEnemyBadge === null ||
    teamEnemyLabel === null ||
    teamEnemyMembers === null ||
    teamEnemyKills === null ||
    teamEnemyPoints === null
  ) {
    throw new Error('FUNNEL team HUD nodes were not created.');
  }

  const weaponBar = hud.querySelector<HTMLDivElement>('.funnel-weapon-bar');
  if (weaponBar === null) {
    throw new Error('FUNNEL weapon bar HUD node was not created.');
  }

  const ammoHud = hud.querySelector<HTMLDivElement>('.funnel-ammo');
  const ammoTitle = hud.querySelector<HTMLSpanElement>('.funnel-ammo__title');
  const ammoCount = hud.querySelector<HTMLSpanElement>('.funnel-ammo__count');
  const ammoMagazine = hud.querySelector<HTMLDivElement>('.funnel-ammo__mag');
  const ammoReloadFill = hud.querySelector<HTMLDivElement>('.funnel-ammo__reload-fill');
  if (
    ammoHud === null ||
    ammoTitle === null ||
    ammoCount === null ||
    ammoMagazine === null ||
    ammoReloadFill === null
  ) {
    throw new Error('FUNNEL ammo HUD nodes were not created.');
  }

  const healthHud = hud.querySelector<HTMLDivElement>('.funnel-health');
  const shieldFill = hud.querySelector<HTMLDivElement>('.funnel-shield__fill');
  const healthFill = hud.querySelector<HTMLDivElement>('.funnel-health__fill');
  if (healthHud === null || shieldFill === null || healthFill === null) {
    throw new Error('FUNNEL health HUD nodes were not created.');
  }

  const crosshair = hud.querySelector<HTMLDivElement>('.funnel-crosshair');
  if (crosshair === null) {
    throw new Error('FUNNEL crosshair HUD node was not created.');
  }

  const damageVignette = hud.querySelector<HTMLDivElement>('.funnel-damage-vignette');
  if (damageVignette === null) {
    throw new Error('FUNNEL damage vignette HUD node was not created.');
  }

  const fpsHud = hud.querySelector<HTMLDivElement>('.funnel-fps-hud');
  const fpsValue = hud.querySelector<HTMLSpanElement>('.funnel-fps-hud__value');
  const fpsCanvas = hud.querySelector<HTMLCanvasElement>('.funnel-fps-hud__graph');
  if (fpsHud === null || fpsValue === null || fpsCanvas === null) {
    throw new Error('FUNNEL FPS HUD nodes were not created.');
  }

  shell.append(canvas, hud, status);
  root.append(preMatchHost, shell);

  return {
    preMatchHost,
    canvas,
    shell,
    hud,
    status,
    personalStatsHud,
    personalStatsKills,
    personalStatsDeaths,
    personalStatsKdRatio,
    teamOwnBadge,
    teamOwnLabel,
    teamOwnMembers,
    teamOwnKills,
    teamOwnPoints,
    teamEnemyBadge,
    teamEnemyLabel,
    teamEnemyMembers,
    teamEnemyKills,
    teamEnemyPoints,
    weaponBar,
    ammoHud,
    ammoTitle,
    ammoCount,
    ammoMagazine,
    ammoReloadFill,
    healthHud,
    shieldFill,
    healthFill,
    crosshair,
    damageVignette,
    fpsHud,
    fpsValue,
    fpsCanvas
  };
}

function hexColorToCss(hex: number): string {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
