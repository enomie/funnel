import { AudioContextEngine } from '../audio-mixer';
import { getGruntSynth } from './audio-grunt-tts';
import { COUNTDOWN_PHONETIC, NARRATORINE_VOICE } from './audio-narrator-voice-presets';

/** Erzählerin speaks one countdown tick — fire-and-forget. */
export function playCountdownNarratorine(secondsRemaining: number): void {
  const text = COUNTDOWN_PHONETIC[secondsRemaining];
  if (text === undefined) {
    return;
  }

  AudioContextEngine.get().resume();
  void getGruntSynth().playText(NARRATORINE_VOICE, text);
}
