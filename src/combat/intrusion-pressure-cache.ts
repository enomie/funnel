// Path: /Users/johann/MyBrew/funnel-real/src/combat/intrusion-pressure-cache.ts

import type { ActorRegistry } from './actor-registry';
import {
  fillIntrusionPressure,
  resolveFightFocusFaction,
  type IntrusionPressure
} from './intrusion-pressure';
import type { FactionTeam } from './teams';


export class IntrusionPressureCache {
  #frameId = -1;
  readonly #pressure: IntrusionPressure = { alpha: 0, beta: 0 };
  #focusFaction: FactionTeam | null = null;

  pressureForFrame(frameId: number, registry: ActorRegistry): IntrusionPressure {
    if (this.#frameId !== frameId) {
      this.#refresh(frameId, registry);
    }
    return this.#pressure;
  }

  focusFactionForFrame(frameId: number, registry: ActorRegistry): FactionTeam | null {
    if (this.#frameId !== frameId) {
      this.#refresh(frameId, registry);
    }
    return this.#focusFaction;
  }

  #refresh(frameId: number, registry: ActorRegistry): void {
    this.#frameId = frameId;
    fillIntrusionPressure(registry, this.#pressure as { alpha: number; beta: number });
    this.#focusFaction = resolveFightFocusFaction(this.#pressure);
  }
}
