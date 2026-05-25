// Path: /Users/johann/MyBrew/funnel-real/src/ui/ammo-hud.ts

import type { AmmoCellState, AmmoHudSnapshot } from '../combat/ammo-controller';

export interface AmmoHudNodes {
  root: HTMLDivElement;
  title: HTMLSpanElement;
  count: HTMLSpanElement;
  magazine: HTMLDivElement;
  reloadFill: HTMLDivElement;
}

export class AmmoHud {
  readonly #root: HTMLDivElement;
  readonly #title: HTMLSpanElement;
  readonly #count: HTMLSpanElement;
  readonly #magazine: HTMLDivElement;
  readonly #reloadFill: HTMLDivElement;
  #cells: HTMLDivElement[] = [];
  #lastAmmoMax = 0;
  #lastStateKey = '';

  constructor(nodes: AmmoHudNodes) {
    this.#root = nodes.root;
    this.#title = nodes.title;
    this.#count = nodes.count;
    this.#magazine = nodes.magazine;
    this.#reloadFill = nodes.reloadFill;
    this.#root.hidden = true;
  }

  update(snapshot: AmmoHudSnapshot): void {
    const stateKey = snapshot.visible
      ? [
          '1',
          snapshot.weaponName,
          String(snapshot.ammoCurrent),
          String(snapshot.ammoMax),
          String(snapshot.weaponColor),
          snapshot.reloadProgress.toFixed(3),
          snapshot.cellStates.join('')
        ].join('|')
      : '0';

    if (stateKey === this.#lastStateKey) {
      return;
    }

    this.#lastStateKey = stateKey;

    if (!snapshot.visible) {
      this.#root.hidden = true;
      this.#reloadFill.style.width = '0%';
      return;
    }

    this.#root.hidden = false;
    this.#title.textContent = snapshot.weaponName;
    setAmmoAccentColor(this.#root, snapshot.weaponColor);
    this.#count.textContent = String(snapshot.ammoCurrent);
    this.#syncMagazineCells(snapshot);
    const reloadPercent = Math.round(snapshot.reloadProgress * 100);
    this.#reloadFill.style.width = `${reloadPercent.toString()}%`;
  }

  #syncMagazineCells(snapshot: AmmoHudSnapshot): void {
    if (snapshot.ammoMax !== this.#lastAmmoMax) {
      this.#magazine.replaceChildren();
      this.#cells = [];
      this.#lastAmmoMax = snapshot.ammoMax;

      for (let index = 0; index < snapshot.ammoMax; index += 1) {
        const cell = document.createElement('div');
        cell.className = 'funnel-ammo__cell';
        cell.setAttribute('aria-hidden', 'true');
        this.#magazine.append(cell);
        this.#cells.push(cell);
      }
    }

    const baseColor = colorToCss(snapshot.weaponColor);
    const chamberColor = darkenColor(snapshot.weaponColor, 0.42);
    const reservedColor = darkenColor(snapshot.weaponColor, 0.28);

    for (let index = 0; index < this.#cells.length; index += 1) {
      const state: AmmoCellState = snapshot.cellStates[index] ?? 'empty';
      const cell = this.#cells[index];
      cell.dataset.state = state;

      switch (state) {
        case 'filled':
          cell.style.backgroundColor = baseColor;
          break;
        case 'reserved':
          cell.style.backgroundColor = reservedColor;
          break;
        case 'chambering':
          cell.style.backgroundColor = chamberColor;
          break;
        default:
          cell.style.backgroundColor = '';
          break;
      }
    }
  }
}

function setAmmoAccentColor(root: HTMLDivElement, hex: number): void {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  root.style.setProperty('--funnel-ammo-accent-rgb', `${String(r)}, ${String(g)}, ${String(b)}`);
}

function colorToCss(hex: number): string {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`;
}

function darkenColor(hex: number, amount: number): string {
  const r = Math.round(((hex >> 16) & 255) * (1 - amount));
  const g = Math.round(((hex >> 8) & 255) * (1 - amount));
  const b = Math.round((hex & 255) * (1 - amount));
  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`;
}
