import { WeaponAudio } from './audio-weapon/audio-weapon';
import { warmWeaponBakes } from './audio-weapon/audio-weapon-bake';
import { AudioContextEngine } from './audio-mixer';
import { syncAudioListenerFromCamera } from './audio-system';

export { WeaponAudio, syncAudioListenerFromCamera };

export function resumeGameAudio(): void {
  AudioContextEngine.get().resume();
}

export async function warmGameAudio(): Promise<void> {
  AudioContextEngine.get().resume();
  await warmWeaponBakes();
}

export function createWeaponAudio(): WeaponAudio {
  return new WeaponAudio();
}
