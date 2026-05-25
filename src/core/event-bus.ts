// Path: /Users/johann/MyBrew/funnel-real/src/core/event-bus.ts

import type { GameEventMap, GameEventName } from './game-events';

type GameEventListener<K extends GameEventName> = (payload: GameEventMap[K]) => void;

export class GameEventBus {
  readonly #listeners = new Map<GameEventName, Set<GameEventListener<GameEventName>>>();

  on<K extends GameEventName>(event: K, listener: GameEventListener<K>): () => void {
    let bucket = this.#listeners.get(event);
    if (bucket === undefined) {
      bucket = new Set();
      this.#listeners.set(event, bucket);
    }

    const wrapped = listener as GameEventListener<GameEventName>;
    bucket.add(wrapped);
    return () => {
      bucket.delete(wrapped);
    };
  }

  emit<K extends GameEventName>(event: K, payload: GameEventMap[K]): void {
    const bucket = this.#listeners.get(event);
    if (bucket === undefined) {
      return;
    }

    for (const listener of bucket) {
      listener(payload);
    }
  }
}
