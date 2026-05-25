// Path: /Users/johann/MyBrew/funnel-real/src/game-audio/audio-grunts/audio-match-narration.ts

import { tryResumeGameAudio } from '../audio-guard';
import { getGruntSynth } from './audio-grunt-tts';
import { getNarratorCountdownDestination } from './audio-narrator-reverb';
import { COUNTDOWN_PHONETIC, NARRATORINE_VOICE } from './audio-narrator-voice-presets';


export function playCountdownNarratorine(secondsRemaining: number): void {
  const text = COUNTDOWN_PHONETIC[secondsRemaining];
  if (text === undefined) {
    return;
  }

  tryResumeGameAudio();
  void getGruntSynth().playText(NARRATORINE_VOICE, text, getNarratorCountdownDestination());
}

/** Local viewer death respawn only — Web Audio is not shared with bots or other clients. */
export function playLocalDeathRespawnCountdown(secondsRemaining: number): void {
  playCountdownNarratorine(secondsRemaining);
}
