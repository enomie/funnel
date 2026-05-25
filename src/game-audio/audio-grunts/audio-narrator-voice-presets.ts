// Path: /Users/johann/MyBrew/funnel-real/src/game-audio/audio-grunts/audio-narrator-voice-presets.ts

import type { GruntVoiceSettings } from './audio-grunt-synth';


export const NARRATORINE_VOICE: GruntVoiceSettings = {
  pitch: 272,
  breath: 0.05,
  brightness: 0.84,
  intensity: 0.76
};


export const COUNTDOWN_PHONETIC: Partial<Record<number, string>> = {
  10: 'ten',
  9: 'nain',
  8: 'eit',
  7: 'seven',
  6: 'siks',
  5: 'faiv',
  4: 'for',
  3: 'thrii',
  2: 'tu',
  1: 'wan'
};
