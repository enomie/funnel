// Path: /Users/johann/MyBrew/funnel-real/src/game-audio/audio-manager.ts

import { WeaponAudio } from './audio-weapon/audio-weapon';
import { warmWeaponBakes } from './audio-weapon/audio-weapon-bake';
import { cleanupFlybyVoices, warmFlybyVoicePool } from './audio-flyby/audio-flyby-voice';
import { tickCombatWorldAudio, stabilizeCombatAudioAfterDeath } from './combat-world-audio';
import { tickGameAudioGuard, tryResumeGameAudio } from './audio-guard';
import { AudioContextEngine } from './audio-mixer';
import { sweepExpiredSpatialOneShots } from './audio-spatial-voice';
import { syncAudioListenerFromCamera } from './audio-system';

export { WeaponAudio, syncAudioListenerFromCamera };

export function resumeGameAudio(): void {
  AudioContextEngine.get().resume();
}

export { waitForGameAudioUnlock } from './audio-unlock';

export async function warmGameAudio(): Promise<void> {
  AudioContextEngine.get().resume();
  warmFlybyVoicePool();
  await warmWeaponBakes();
}

export { stabilizeCombatAudioAfterDeath };

export function tickGameAudio(_frameNowMs: number): void {
  tickGameAudioGuard();
  sweepExpiredSpatialOneShots();
  cleanupFlybyVoices();
  tickCombatWorldAudio();
}

let userGestureResumeBound = false;

export function bindGameAudioUserGestureResume(target: EventTarget): void {
  if (userGestureResumeBound) {
    return;
  }

  userGestureResumeBound = true;
  const resumeOnGesture = (): void => {
    tryResumeGameAudio();
  };
  target.addEventListener('pointerdown', resumeOnGesture, { passive: true });
  target.addEventListener('keydown', resumeOnGesture, { passive: true });
}

export function createWeaponAudio(): WeaponAudio {
  return new WeaponAudio();
}
