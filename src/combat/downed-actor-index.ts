// Path: /Users/johann/MyBrew/funnel-real/src/combat/downed-actor-index.ts

import type { ActorDeathSnapshot } from '../player/actor-death';
import type { CombatActor } from './combat-actor';

export interface DownedActorEntry {
  readonly actorId: string;
  readonly actor: CombatActor;
  readonly deathSnapshot: ActorDeathSnapshot;
}

export class DownedActorIndex {
  readonly #entries: DownedActorEntry[] = [];
  #count = 0;

  get count(): number {
    return this.#count;
  }

  entryAt(index: number): DownedActorEntry {
    return this.#entries[index];
  }

  add(entry: DownedActorEntry): void {
    for (let index = 0; index < this.#count; index += 1) {
      if (this.#entries[index].actorId === entry.actorId) {
        this.#entries[index] = entry;
        return;
      }
    }

    this.#entries[this.#count] = entry;
    this.#count += 1;
  }

  remove(actorId: string): void {
    for (let index = 0; index < this.#count; index += 1) {
      if (this.#entries[index].actorId !== actorId) {
        continue;
      }

      const lastIndex = this.#count - 1;
      if (index !== lastIndex) {
        this.#entries[index] = this.#entries[lastIndex];
      }

      this.#count -= 1;
      return;
    }
  }

  clear(): void {
    this.#count = 0;
  }
}
