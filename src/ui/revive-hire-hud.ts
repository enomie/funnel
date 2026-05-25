// Path: /Users/johann/MyBrew/funnel-real/src/ui/revive-hire-hud.ts

import type { ReviveHireChannelMode } from '../player/actor-death';

export interface ReviveHireHudMount {
  shell: HTMLElement;
}

export class ReviveHireHud {
  readonly #panel: HTMLDivElement;
  readonly #label: HTMLParagraphElement;
  readonly #fill: HTMLDivElement;
  readonly #percent: HTMLParagraphElement;
  #visible = false;
  #lastMode: ReviveHireChannelMode | null = null;
  #lastProgressPct = -1;

  constructor(mount: ReviveHireHudMount) {
    const panel = document.createElement('div');
    panel.className = 'funnel-revive-hire-panel';
    panel.dataset.visible = 'false';
    panel.innerHTML = `
      <p class="funnel-revive-hire-panel__label"></p>
      <div class="funnel-revive-hire-panel__track" aria-hidden="true">
        <div class="funnel-revive-hire-panel__fill"></div>
      </div>
      <p class="funnel-revive-hire-panel__percent" aria-live="polite">0%</p>
    `;

    const label = panel.querySelector<HTMLParagraphElement>('.funnel-revive-hire-panel__label');
    const fill = panel.querySelector<HTMLDivElement>('.funnel-revive-hire-panel__fill');
    const percent = panel.querySelector<HTMLParagraphElement>('.funnel-revive-hire-panel__percent');
    if (label === null || fill === null || percent === null) {
      throw new Error('FUNNEL revive/hire panel nodes were not created.');
    }

    this.#panel = panel;
    this.#label = label;
    this.#fill = fill;
    this.#percent = percent;
    mount.shell.append(panel);
  }

  update(visible: boolean, mode: ReviveHireChannelMode | null, progress01: number): void {
    const progressPct = visible ? Math.round(Math.min(1, Math.max(0, progress01)) * 100) : 0;

    if (!visible) {
      if (this.#visible) {
        this.#visible = false;
        this.#lastMode = null;
        this.#lastProgressPct = -1;
        this.#panel.dataset.visible = 'false';
        this.#fill.style.width = '0%';
        this.#percent.textContent = '0%';
      }
      return;
    }

    if (!this.#visible) {
      this.#visible = true;
      this.#panel.dataset.visible = 'true';
    }

    if (mode !== this.#lastMode) {
      this.#lastMode = mode;
      this.#label.textContent = mode === 'hire' ? 'HIRE' : 'REVIVE';
      this.#panel.dataset.mode = mode ?? 'revive';
    }

    if (progressPct !== this.#lastProgressPct) {
      this.#lastProgressPct = progressPct;
      this.#fill.style.width = `${String(progressPct)}%`;
      this.#percent.textContent = `${String(progressPct)}%`;
    }
  }
}
