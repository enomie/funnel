import type { RigidBody } from '@dimforge/rapier3d-simd-compat';
import type { FactionTeam } from '../combat/teams';
import type { BotActor } from './bot-actor';
import type { BotCombatTargetSnapshot } from './bot-targeting';

interface MutableTargetSnapshot {
  x: number;
  y: number;
  z: number;
  faction: FactionTeam;
  body: RigidBody;
  isDead: boolean;
}

export interface BotTargetPlayerSnapshot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly faction: FactionTeam;
  readonly isDead: boolean;
  readonly body: RigidBody;
}

export class BotTargetSnapshotCache {
  readonly #snapshots: MutableTargetSnapshot[] = [];

  get targets(): readonly BotCombatTargetSnapshot[] {
    return this.#snapshots;
  }

  syncFromRoster(player: BotTargetPlayerSnapshot, bots: readonly BotActor[]): void {
    if (!this.#structureMatches(player, bots)) {
      this.#rebuild(player, bots);
      return;
    }

    this.#patchPositions(player, bots);
  }

  #structureMatches(
    player: BotTargetPlayerSnapshot,
    bots: readonly BotActor[]
  ): boolean {
    let expectedCount = player.isDead ? 0 : 1;
    for (let index = 0; index < bots.length; index += 1) {
      if (!bots[index].controller.health.isDead) {
        expectedCount += 1;
      }
    }

    if (expectedCount !== this.#snapshots.length) {
      return false;
    }

    let snapshotIndex = 0;

    if (!player.isDead) {
      if (this.#snapshots[snapshotIndex].body.handle !== player.body.handle) {
        return false;
      }
      snapshotIndex += 1;
    }

    for (let index = 0; index < bots.length; index += 1) {
      const bot = bots[index];
      if (bot.controller.health.isDead) {
        continue;
      }

      if (this.#snapshots[snapshotIndex].body.handle !== bot.controller.body.handle) {
        return false;
      }
      snapshotIndex += 1;
    }

    return true;
  }

  #rebuild(player: BotTargetPlayerSnapshot, bots: readonly BotActor[]): void {
    this.#snapshots.length = 0;

    if (!player.isDead) {
      this.#snapshots.push({
        x: player.x,
        y: player.y,
        z: player.z,
        faction: player.faction,
        body: player.body,
        isDead: false
      });
    }

    for (const bot of bots) {
      if (bot.controller.health.isDead) {
        continue;
      }

      const translation = bot.controller.body.translation();
      this.#snapshots.push({
        x: translation.x,
        y: translation.y,
        z: translation.z,
        faction: bot.controller.faction,
        body: bot.controller.body,
        isDead: false
      });
    }
  }

  #patchPositions(player: BotTargetPlayerSnapshot, bots: readonly BotActor[]): void {
    let index = 0;

    if (!player.isDead && index < this.#snapshots.length) {
      const entry = this.#snapshots[index];
      entry.x = player.x;
      entry.y = player.y;
      entry.z = player.z;
      index += 1;
    }

    for (const bot of bots) {
      if (bot.controller.health.isDead) {
        continue;
      }

      if (index >= this.#snapshots.length) {
        break;
      }

      const entry = this.#snapshots[index];
      const translation = bot.controller.body.translation();
      entry.x = translation.x;
      entry.y = translation.y;
      entry.z = translation.z;
      index += 1;
    }
  }
}
