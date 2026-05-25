import { WEAPON_DEFINITIONS } from '../combat/weapon-definitions';

export interface WeaponBarHudNodes {
  root: HTMLDivElement;
}

interface WeaponBarSlot {
  root: HTMLDivElement;
}

export class WeaponBarHud {
  readonly #root: HTMLDivElement;
  readonly #slots: WeaponBarSlot[];
  #lastStateKey = '';

  constructor(nodes: WeaponBarHudNodes) {
    this.#root = nodes.root;
    const slotsHost = this.#root.querySelector<HTMLDivElement>('.funnel-weapon-bar__slots');
    if (slotsHost === null) {
      throw new Error('FUNNEL weapon bar slots node was not created.');
    }

    this.#slots = WEAPON_DEFINITIONS.map((weapon) => {
      const slot = document.createElement('div');
      slot.className = 'funnel-weapon-bar__slot';
      slot.style.setProperty('--funnel-weapon-color', colorToCss(weapon.color));
      slot.setAttribute('aria-label', `${weapon.slotLabel} ${weapon.name}`);

      const key = document.createElement('span');
      key.className = 'funnel-weapon-bar__key';
      key.textContent = weapon.slotLabel;
      key.setAttribute('aria-hidden', 'true');

      const name = document.createElement('span');
      name.className = 'funnel-weapon-bar__name';
      name.textContent = weaponShortName(weapon.name);
      name.style.color = colorToCss(weapon.color);
      name.setAttribute('aria-hidden', 'true');

      slot.append(key, name);
      slotsHost.append(slot);
      return { root: slot };
    });
    this.#root.hidden = true;
  }

  update(visible: boolean, selectedIndex: number): void {
    const stateKey = visible ? `1|${String(selectedIndex)}` : '0';

    if (stateKey === this.#lastStateKey) {
      return;
    }

    this.#lastStateKey = stateKey;

    if (!visible) {
      this.#root.hidden = true;
      return;
    }

    this.#root.hidden = false;

    for (let index = 0; index < this.#slots.length; index += 1) {
      this.#slots[index].root.dataset.active = index === selectedIndex ? 'true' : 'false';
    }
  }
}

function weaponShortName(name: string): string {
  return name.split(' ')[0];
}

function colorToCss(hex: number): string {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`;
}
