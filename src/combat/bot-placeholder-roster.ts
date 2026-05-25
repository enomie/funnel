import type { Scene } from 'three/webgpu';
import type { ShooterPackCharacter } from '../player/shooter-pack-loader';
import type { PlayerTeam } from '../player/player-team';
import { BotPlaceholder } from './bot-placeholder';
import { devPlaceholderMatchStartSpawnSlots } from './match-roster';

export class BotPlaceholderRoster {
  readonly #scene: Scene;
  readonly #viewerTeam: PlayerTeam;
  #bots: BotPlaceholder[] = [];

  constructor(scene: Scene, viewerTeam: PlayerTeam) {
    this.#scene = scene;
    this.#viewerTeam = viewerTeam;
    this.#viewerTeam.onChange(() => {
      this.refreshViewerColors();
    });
  }

  spawn(template?: ShooterPackCharacter): void {
    this.clear();
    const slots = devPlaceholderMatchStartSpawnSlots(this.#viewerTeam.faction);

    for (const slot of slots) {
      this.#bots.push(new BotPlaceholder(this.#scene, slot, this.#viewerTeam, template));
    }
  }

  refreshViewerColors(): void {
    for (const bot of this.#bots) {
      bot.applyViewerColors(this.#viewerTeam);
    }
  }

  update(deltaSeconds: number): void {
    for (const bot of this.#bots) {
      bot.update(deltaSeconds);
    }
  }

  clear(): void {
    for (const bot of this.#bots) {
      this.#scene.remove(bot.root);
    }

    this.#bots = [];
  }
}
