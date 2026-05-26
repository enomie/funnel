// Path: /Users/johann/MyBrew/funnel-real/src/ui/character-select-hover-tts.ts

import type { HumanoidRigId } from '../player/humanoid-rig';
import { speakPrematchHoverGrunt } from '../game-audio/audio-grunts/audio-grunt-tts';

const HOVER_GREETING = 'Aua';
const HOVER_GREETING_INTERVAL_MS = 2000;


export class CharacterSelectHoverTts {
  #intervalId = 0;
  #activeRig: HumanoidRigId | null = null;

  setHover(rigId: HumanoidRigId | null): void {
    if (rigId === this.#activeRig) {
      return;
    }

    this.stop();
    if (rigId === null) {
      return;
    }

    this.#activeRig = rigId;
    void speakPrematchHoverGrunt(HOVER_GREETING, rigId);
    this.#intervalId = window.setInterval(() => {
      if (this.#activeRig === null) {
        return;
      }
      void speakPrematchHoverGrunt(HOVER_GREETING, this.#activeRig);
    }, HOVER_GREETING_INTERVAL_MS);
  }

  stop(): void {
    if (this.#intervalId !== 0) {
      window.clearInterval(this.#intervalId);
      this.#intervalId = 0;
    }
    this.#activeRig = null;
  }
}
