// Path: /Users/johann/MyBrew/funnel-real/src/combat/intrusion-pressure.ts

import { isInEnemyTerritory } from '../arena/funnel-zones';
import type { ActorRegistry } from './actor-registry';
import type { FactionTeam } from './teams';


export interface IntrusionPressure {
  readonly alpha: number;
  readonly beta: number;
}

type MutableIntrusionPressure = {
  alpha: number;
  beta: number;
};

export function fillIntrusionPressure(
  registry: ActorRegistry,
  out: MutableIntrusionPressure
): IntrusionPressure {
  out.alpha = 0;
  out.beta = 0;

  registry.forEachActor((actor) => {
    if (actor.health.isDead) {
      return;
    }

    const faction = actor.getFaction();
    const worldZ = actor.body.translation().z;
    if (!isInEnemyTerritory(faction, worldZ)) {
      return;
    }

    if (faction === 'beta') {
      out.alpha += 1;
    } else {
      out.beta += 1;
    }
  });

  return out;
}


export function countIntrusionPressure(registry: ActorRegistry): IntrusionPressure {
  return fillIntrusionPressure(registry, { alpha: 0, beta: 0 });
}


export function resolveFightFocusFaction(pressure: IntrusionPressure): FactionTeam | null {
  if (pressure.alpha === 0 && pressure.beta === 0) {
    return null;
  }

  if (pressure.alpha > pressure.beta) {
    return 'alpha';
  }

  if (pressure.beta > pressure.alpha) {
    return 'beta';
  }

  return null;
}
