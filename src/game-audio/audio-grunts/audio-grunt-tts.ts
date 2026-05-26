// Path: /Users/johann/MyBrew/funnel-real/src/game-audio/audio-grunts/audio-grunt-tts.ts

import type { HumanoidRigId } from '../../player/humanoid-rig';
import { tryBeginSpatialOneShot } from '../audio-spatial-voice';
import { fillCapsuleFootPoint, spatialVectorFromPoint } from '../audio-system';
import { AudioContextEngine } from '../audio-mixer';
import { AUDIO_PREMATCH_HOVER_TTS_GAIN } from '../audio-config';
import { GruntSynth } from './audio-grunt-synth';
import {
  gruntVoiceSettingsForId,
  gruntVoiceSettingsForRig,
  type GruntVoiceId
} from './audio-grunt-voice-presets';

let sharedSynth: GruntSynth | null = null;
let prematchHoverTtsInput: GainNode | null = null;

function getPrematchHoverTtsDestination(): AudioNode {
  if (prematchHoverTtsInput === null) {
    const engine = AudioContextEngine.get();
    prematchHoverTtsInput = engine.context.createGain();
    prematchHoverTtsInput.gain.value = AUDIO_PREMATCH_HOVER_TTS_GAIN;
    prematchHoverTtsInput.connect(engine.sfxInput);
  }
  return prematchHoverTtsInput;
}

export function getGruntSynth(): GruntSynth {
  sharedSynth ??= new GruntSynth({
    getContext: () => AudioContextEngine.get().context,
    getDestination: () => AudioContextEngine.get().sfxInput
  });
  return sharedSynth;
}


export async function speakGrunt(text: string, rigId: HumanoidRigId): Promise<void> {
  AudioContextEngine.get().resume();
  await getGruntSynth().playText(gruntVoiceSettingsForRig(rigId), text);
}

export async function speakPrematchHoverGrunt(text: string, rigId: HumanoidRigId): Promise<void> {
  AudioContextEngine.get().resume();
  await getGruntSynth().playText(
    gruntVoiceSettingsForRig(rigId),
    text,
    getPrematchHoverTtsDestination()
  );
}


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


export async function speakGruntVoice(text: string, voiceId: GruntVoiceId): Promise<void> {
  AudioContextEngine.get().resume();
  await getGruntSynth().playText(gruntVoiceSettingsForId(voiceId), text);
}


export function normalizeGruntText(text: string): string {
  return getGruntSynth().normalizePhoneticText(text);
}
