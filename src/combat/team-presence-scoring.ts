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

/** Award +1 point per living actor in enemy territory each full second; returns winner if decided. */
export function tickTeamPresenceScoring(
  deltaSeconds: number,
  accumulator: PresenceTickAccumulator,
  registry: ActorRegistry,
  points: TeamMatchPoints
): FactionTeam | null {
  if (points.isMatchOver) {
    return points.winner;
  }

  accumulator.seconds += deltaSeconds;

  while (accumulator.seconds >= PRESENCE_TICK_SECONDS) {
    accumulator.seconds -= PRESENCE_TICK_SECONDS;

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
      return winner;
    }
  }

  return null;
}
