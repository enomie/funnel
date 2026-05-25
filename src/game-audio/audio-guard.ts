// Path: /Users/johann/MyBrew/funnel-real/src/game-audio/audio-guard.ts

import { AudioContextEngine } from './audio-mixer';
import { audioError } from './audio-debug';

let audioPermanentlyDead = false;
let killLogged = false;

const silenceHooks: Array<() => void> = [];

export function registerAudioSilenceHook(hook: () => void): void {
  silenceHooks.push(hook);
}

export function isAudioKilled(): boolean {
  return audioPermanentlyDead;
}

function markAudioPermanentlyDead(reason: string, error?: unknown): void {
  if (audioPermanentlyDead) {
    return;
  }

  audioPermanentlyDead = true;

  if (!killLogged) {
    killLogged = true;
    const context = AudioContextEngine.get().context;
    console.error('[audio:KILLED — game audio disabled]', {
      reason,
      contextState: context.state,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : error
    });
  }

  for (const hook of silenceHooks) {
    try {
      hook();
    } catch (hookError: unknown) {
      console.error('[audio:KILLED — silence hook failed]', hookError);
    }
  }
}

/** @deprecated Use markAudioPermanentlyDead semantics; only closed contexts are permanent. */
export function killAudio(reason: string, error?: unknown): void {
  markAudioPermanentlyDead(reason, error);
}

export { markAudioPermanentlyDead };

export function tryResumeGameAudio(): void {
  if (audioPermanentlyDead) {
    return;
  }

  const context = AudioContextEngine.get().context;
  if (context.state === 'closed') {
    markAudioPermanentlyDead('AudioContext closed (resume attempt)');
    return;
  }

  if (context.state === 'suspended') {
    void context.resume().catch((error: unknown) => {
      audioError('resume-failed', error, { state: context.state });
    });
  }
}

export function isAudioAlive(): boolean {
  if (audioPermanentlyDead) {
    return false;
  }

  const context = AudioContextEngine.get().context;
  if (context.state === 'closed') {
    markAudioPermanentlyDead('AudioContext entered closed state');
    return false;
  }

  return true;
}

export function safeCreateNode<T>(tag: string, factory: () => T): T | null {
  if (!isAudioAlive()) {
    return null;
  }

  tryResumeGameAudio();

  try {
    return factory();
  } catch (error: unknown) {
    audioError(`${tag}: node creation failed`, error);
    return null;
  }
}

export function safeStart(
  source: AudioScheduledSourceNode | OscillatorNode,
  time: number,
  tag: string
): boolean {
  if (!isAudioAlive()) {
    return false;
  }

  tryResumeGameAudio();

  try {
    source.start(time);
    return true;
  } catch (error: unknown) {
    audioError(`${tag}: start failed`, error);
    return false;
  }
}

export function safeStop(
  source: AudioScheduledSourceNode | OscillatorNode,
  time: number,
  _tag: string
): void {
  if (audioPermanentlyDead) {
    return;
  }

  try {
    source.stop(time);
  } catch {
    // Source may already be stopped.
  }
}

export function safeConnect(from: AudioNode, to: AudioNode, tag: string): boolean {
  if (!isAudioAlive()) {
    return false;
  }

  tryResumeGameAudio();

  try {
    from.connect(to);
    return true;
  } catch (error: unknown) {
    audioError(`${tag}: connect failed`, error);
    return false;
  }
}

export function safeDisconnect(node: AudioNode, _tag: string): void {
  if (audioPermanentlyDead) {
    return;
  }

  try {
    node.disconnect();
  } catch {
    // Node may already be disconnected.
  }
}

export function tickGameAudioGuard(): void {
  if (audioPermanentlyDead) {
    return;
  }

  const context = AudioContextEngine.get().context;
  if (context.state === 'closed') {
    markAudioPermanentlyDead('AudioContext closed (frame tick)');
    return;
  }

  if (context.state === 'suspended' || context.state === 'interrupted') {
    tryResumeGameAudio();
  }
}
