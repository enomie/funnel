// Path: /Users/johann/MyBrew/funnel-real/src/game-audio/audio-debug.ts

const LS_KEY = 'funnel:audioDebug';

let cachedEnabled: boolean | null = null;

export function isAudioDebugEnabled(): boolean {
  if (cachedEnabled !== null) {
    return cachedEnabled;
  }

  if (typeof globalThis.location === 'undefined') {
    cachedEnabled = false;
    return cachedEnabled;
  }

  const params = new URLSearchParams(globalThis.location.search);
  cachedEnabled =
    params.has('audioDebug') ||
    globalThis.localStorage.getItem(LS_KEY) === '1';
  return cachedEnabled;
}

export function audioLog(tag: string, detail?: Record<string, unknown>): void {
  if (!isAudioDebugEnabled()) {
    return;
  }

  if (detail === undefined) {
    console.log(`[audio:${tag}]`);
    return;
  }

  console.log(`[audio:${tag}]`, detail);
}

const warnOnceKeys = new Set<string>();
const logThrottleAt = new Map<string, number>();

export function audioWarn(tag: string, detail?: Record<string, unknown>): void {
  if (!isAudioDebugEnabled()) {
    return;
  }

  if (detail === undefined) {
    console.warn(`[audio:${tag}]`);
    return;
  }

  console.warn(`[audio:${tag}]`, detail);
}

export function audioWarnOnce(key: string, tag: string, detail?: Record<string, unknown>): void {
  if (warnOnceKeys.has(key)) {
    return;
  }

  warnOnceKeys.add(key);
  console.warn(`[audio:${tag}]`, detail);
}

export function audioLogThrottled(
  key: string,
  intervalMs: number,
  tag: string,
  detail?: Record<string, unknown>
): void {
  if (!isAudioDebugEnabled()) {
    return;
  }

  const now = performance.now();
  const last = logThrottleAt.get(key) ?? 0;
  if (now - last < intervalMs) {
    return;
  }

  logThrottleAt.set(key, now);
  audioLog(tag, detail);
}

export function audioError(tag: string, error: unknown, detail?: Record<string, unknown>): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(`[audio:${tag}]`, { message, stack, ...detail });
}

export function runAudioSafe<T>(tag: string, fn: () => T, detail?: Record<string, unknown>): T | undefined {
  try {
    return fn();
  } catch (error) {
    audioError(tag, error, detail);
    return undefined;
  }
}

export function runAudioSafeVoid(tag: string, fn: () => void, detail?: Record<string, unknown>): void {
  try {
    fn();
  } catch (error) {
    audioError(tag, error, detail);
  }
}

export function logAudioContextState(context: AudioContext, reason: string): void {
  audioLog('context-state', {
    reason,
    state: context.state,
    sampleRate: context.sampleRate,
    currentTime: context.currentTime
  });

  if (context.state === 'closed') {
    audioWarnOnce('context-closed', 'context-closed', { reason });
  } else if (context.state === 'interrupted') {
    audioWarnOnce('context-interrupted', 'context-interrupted', { reason });
  }
}

export function attachAudioContextStateLogger(
  context: AudioContext,
  onClosed?: (reason: string) => void
): void {
  context.addEventListener('statechange', () => {
    logAudioContextState(context, 'statechange');
    if (context.state === 'closed') {
      onClosed?.('closed');
    }
  });

  logAudioContextState(context, 'init');
  if (context.state === 'closed') {
    onClosed?.('closed-at-init');
  }
}
