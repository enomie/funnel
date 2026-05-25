import type { HumanoidRigId } from '../../player/humanoid-rig';
import type { GruntVoiceSettings } from './audio-grunt-synth';

export type GruntVoiceId = 'male' | 'female';

export interface GruntVoicePresetValues {
  pitch: number;
  breath: number;
  brightness: number;
  intensity: number;
}

export interface GruntVoicePreset {
  label: string;
  values: GruntVoicePresetValues;
}

export interface GruntVoiceDefinition {
  id: GruntVoiceId;
  label: string;
  description: string;
  defaults: GruntVoicePresetValues & { text: string };
  presets: GruntVoicePreset[];
}

export const GRUNT_VOICE_PRESETS: Record<GruntVoiceId, GruntVoiceDefinition> = {
  male: {
    id: 'male',
    label: 'Male',
    description: 'Lower, rougher base voice.',
    defaults: {
      pitch: 118,
      breath: 0.14,
      brightness: 0.34,
      intensity: 0.82,
      text: 'wuhuu! aa-rgh, khra'
    },
    presets: [
      { label: 'Neutral', values: { pitch: 118, breath: 0.14, brightness: 0.34, intensity: 0.82 } },
      { label: 'Deep', values: { pitch: 102, breath: 0.18, brightness: 0.28, intensity: 0.88 } },
      { label: 'Young', values: { pitch: 138, breath: 0.1, brightness: 0.45, intensity: 0.76 } },
      { label: 'Rough', values: { pitch: 110, breath: 0.24, brightness: 0.3, intensity: 0.94 } }
    ]
  },
  female: {
    id: 'female',
    label: 'Female',
    description: 'Higher, brighter base voice.',
    defaults: {
      pitch: 208,
      breath: 0.12,
      brightness: 0.56,
      intensity: 0.72,
      text: 'ya! hii-yaa, shaa'
    },
    presets: [
      { label: 'Neutral', values: { pitch: 208, breath: 0.12, brightness: 0.56, intensity: 0.72 } },
      { label: 'Soft', values: { pitch: 186, breath: 0.16, brightness: 0.48, intensity: 0.65 } },
      { label: 'Anime', values: { pitch: 244, breath: 0.08, brightness: 0.7, intensity: 0.74 } },
      { label: 'Strong', values: { pitch: 198, breath: 0.14, brightness: 0.58, intensity: 0.86 } }
    ]
  }
};

/** Y-Bot → lower male grunt voice; X-Bot → higher female grunt voice. */
export const RIG_GRUNT_VOICE: Record<HumanoidRigId, GruntVoiceId> = {
  'y-bot': 'male',
  'x-bot': 'female'
};

export function gruntVoiceSettingsForRig(rigId: HumanoidRigId): GruntVoiceSettings {
  const voiceId = RIG_GRUNT_VOICE[rigId];
  const { pitch, breath, brightness, intensity } = GRUNT_VOICE_PRESETS[voiceId].defaults;
  return { pitch, breath, brightness, intensity };
}

export function gruntVoiceSettingsForId(voiceId: GruntVoiceId): GruntVoiceSettings {
  const { pitch, breath, brightness, intensity } = GRUNT_VOICE_PRESETS[voiceId].defaults;
  return { pitch, breath, brightness, intensity };
}

/** Demo / debug phrase list from the original synth playground. */
export const GRUNT_EXAMPLE_PHRASES: readonly string[] = [
  'A E I O U',
  'Wuhuu',
  'Argh',
  'Hii-yaa',
  'Grrr',
  'Nooo',
  'Help',
  'Attack',
  'Hallo welt',
  'Hello world',
  'Wooohooo'
];
