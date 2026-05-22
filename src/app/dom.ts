export interface AppDom {
  canvas: HTMLCanvasElement;
  shell: HTMLDivElement;
  hud: HTMLDivElement;
  status: HTMLDivElement;
  weaponReadout: HTMLSpanElement;
}

export function createAppDom(root: HTMLDivElement): AppDom {
  root.textContent = '';

  const shell = document.createElement('div');
  shell.className = 'funnel-shell';

  const canvas = document.createElement('canvas');
  canvas.className = 'funnel-canvas';
  canvas.tabIndex = 0;

  const hud = document.createElement('div');
  hud.className = 'funnel-hud';
  hud.innerHTML = `
    <div class="funnel-crosshair" aria-hidden="true"></div>
    <section class="funnel-panel" aria-label="FUNNEL controls">
      <div class="funnel-title">
        <span>FUNNEL playable slice</span>
        <span class="funnel-badge">WebGPU</span>
      </div>
      <dl class="funnel-grid">
        <dt>Move</dt><dd>WASD, Shift sprint, Space jump</dd>
        <dt>Stance</dt><dd>C crouch</dd>
        <dt>Weapon</dt><dd>1-0 select, F weapon mode, LMB fire, RMB ADS</dd>
        <dt>Arsenal</dt><dd><span class="funnel-weapon-readout"></span></dd>
        <dt>Build</dt><dd>Q wall, Z floor, V ramp, Tab cone, Left mouse place</dd>
        <dt>Pointer</dt><dd>Click the arena or press P</dd>
      </dl>
    </section>
  `;

  const status = document.createElement('div');
  status.className = 'funnel-status';
  status.dataset.visible = 'false';
  const weaponReadout = hud.querySelector<HTMLSpanElement>('.funnel-weapon-readout');
  if (weaponReadout === null) {
    throw new Error('FUNNEL weapon HUD node was not created.');
  }

  shell.append(canvas, hud, status);
  root.append(shell);

  return { canvas, shell, hud, status, weaponReadout };
}
