import type { HumanoidRigId } from '../../player/humanoid-rig';
import { tryBeginSpatialOneShot } from '../audio-spatial-voice';
import { fillCapsuleFootPoint, spatialVectorFromPoint } from '../audio-system';
import { AudioContextEngine } from '../audio-mixer';
import { GruntSynth } from './audio-grunt-synth';
import {
  gruntVoiceSettingsForId,
  gruntVoiceSettingsForRig,
  type GruntVoiceId
} from './audio-grunt-voice-presets';

let sharedSynth: GruntSynth | null = null;

export function getGruntSynth(): GruntSynth {
  sharedSynth ??= new GruntSynth({
    getContext: () => AudioContextEngine.get().context,
    getDestination: () => AudioContextEngine.get().sfxInput
  });
  return sharedSynth;
}

/** Speak phonetic / grunt text with the voice matched to the mannequin rig (mono). */
export async function speakGrunt(text: string, rigId: HumanoidRigId): Promise<void> {
  AudioContextEngine.get().resume();
  await getGruntSynth().playText(gruntVoiceSettingsForRig(rigId), text);
}

/**
 * Spatial grunt at capsule feet — heard by player and all bots.
 * `capsuleCenter` = Rapier body translation.
 */
export async function speakGruntAt(
  text: string,
  rigId: HumanoidRigId,
  capsuleCenter: { x: number; y: number; z: number }
): Promise<void> {
  AudioContextEngine.get().resume();
  const settings = gruntVoiceSettingsForRig(rigId);
  const prepared = await getGruntSynth().preparePhrase(settings, text);
  if (prepared === null) {
    return;
  }

  const foot = fillCapsuleFootPoint(capsuleCenter);
  const voice = tryBeginSpatialOneShot(spatialVectorFromPoint(foot), 'grunt');
  if (voice === null) {
    return;
  }

  const source = getGruntSynth().playPreparedPhrase(prepared, voice.input);
  voice.track(source);
  voice.endAfter(source);
}

/** Speak with an explicit male/female preset (debug or UI). */
export async function speakGruntVoice(text: string, voiceId: GruntVoiceId): Promise<void> {
  AudioContextEngine.get().resume();
  await getGruntSynth().playText(gruntVoiceSettingsForId(voiceId), text);
}

/** Preview normalized Lautschrift without playing audio. */
export function normalizeGruntText(text: string): string {
  return getGruntSynth().normalizePhoneticText(text);
}
