// Path: /Users/johann/MyBrew/funnel-real/src/combat/personal-match-stats.ts

import { areSameFaction } from './teams';
import { LOCAL_PLAYER_ACTOR_ID } from './combat-actor';
import type { ActorDiedEvent } from '../core/game-events';


export class PersonalMatchStats {
  #kills = 0;
  #deaths = 0;

  recordActorDied(event: ActorDiedEvent): void {
    if (event.actorId === LOCAL_PLAYER_ACTOR_ID) {
      this.#deaths += 1;
    }

    if (event.sourceActorId !== LOCAL_PLAYER_ACTOR_ID) {
      return;
    }

    if (areSameFaction(event.sourceFaction, event.faction)) {
      return;
    }

    this.#kills += 1;
  }

  kills(): number {
    return this.#kills;
  }

  deaths(): number {
    return this.#deaths;
  }

  reset(): void {
    this.#kills = 0;
    this.#deaths = 0;
  }

  formatKdRatio(): string {
    if (this.#deaths === 0) {
      return this.#kills === 0 ? '0.00' : this.#kills.toFixed(2);
    }

    return (this.#kills / this.#deaths).toFixed(2);
  }
}
