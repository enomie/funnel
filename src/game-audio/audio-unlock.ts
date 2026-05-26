// Path: /Users/johann/MyBrew/funnel-real/src/game-audio/audio-unlock.ts

import { AudioContextEngine } from './audio-mixer';
import { tryResumeGameAudio } from './audio-guard';

function isAudioRunning(): boolean {
  const engine = AudioContextEngine.get();
  if (!engine.isInitialized) {
    return false;
  }

  return engine.context.state === 'running';
}

export async function waitForGameAudioUnlock(): Promise<void> {
  if (isAudioRunning()) {
    return;
  }

  if (AudioContextEngine.get().isInitialized) {
    tryResumeGameAudio();
    if (isAudioRunning()) {
      return;
    }
  }

  await new Promise<void>((resolve) => {
    const unlock = (): void => {
      tryResumeGameAudio();
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
      resolve();
    };

    document.addEventListener('pointerdown', unlock, { passive: true });
    document.addEventListener('keydown', unlock, { passive: true });
  });
}
