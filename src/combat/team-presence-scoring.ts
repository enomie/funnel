// Path: /Users/johann/MyBrew/funnel-real/src/combat/team-presence-scoring.ts

import { isInEnemyTerritory } from '../arena/funnel-zones';
import type { ActorRegistry } from './actor-registry';
import type { TeamMatchPoints } from './team-match-points';
import type { FactionTeam } from './teams';

const PRESENCE_TICK_SECONDS = 1;

export interface PresenceTickAccumulator {
  seconds: number;
}

export function createPresenceTickAccumulator(): PresenceTickAccumulator {
  return { seconds: 0 };
}

export function resetPresenceTickAccumulator(accumulator: PresenceTickAccumulator): void {
  accumulator.seconds = 0;
}


export interface PresenceTickResult {
  winner: FactionTeam | null;
  scored: boolean;
}

export function tickTeamPresenceScoring(
  deltaSeconds: number,
  accumulator: PresenceTickAccumulator,
  registry: ActorRegistry,
  points: TeamMatchPoints
): PresenceTickResult {
  if (points.isMatchOver) {
    return { winner: points.winner, scored: false };
  }

  accumulator.seconds += deltaSeconds;
  let scored = false;

  while (accumulator.seconds >= PRESENCE_TICK_SECONDS) {
    accumulator.seconds -= PRESENCE_TICK_SECONDS;
    scored = true;

    registry.forEachActor((actor) => {
      if (actor.health.isDead) {
        return;
      }

      const worldZ = actor.body.translation().z;
      if (isInEnemyTerritory(actor.getFaction(), worldZ)) {
        points.recordPresenceSecond(actor.getFaction());
      }
    });

    const winner = points.winner;
    if (winner !== null) {
      return { winner, scored: true };
    }
  }

  return { winner: null, scored };
}
