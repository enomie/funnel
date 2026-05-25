/** Fullscreen enter on user gesture; Escape exits explicitly (Chrome / macOS target). */

import { exitArenaPointerLock, requestArenaPointerLock } from '../input/pointer-lock';

let escapeListenerBound = false;

function onFullscreenEscapeKeyDown(event: KeyboardEvent): void {
  if (event.code !== 'Escape' || event.repeat) {
    return;
  }

  if (document.fullscreenElement === null) {
    return;
  }

  event.preventDefault();

  exitArenaPointerLock();

  void document.exitFullscreen().catch(() => undefined);
}

/** Bind Escape → exit fullscreen once at app bootstrap. */
export function initAppFullscreen(): void {
  if (escapeListenerBound) {
    return;
  }

  escapeListenerBound = true;
  document.addEventListener('keydown', onFullscreenEscapeKeyDown, { capture: true });
}

/** Must run synchronously inside a click/key user gesture. */
export function requestAppFullscreen(): void {
  if (document.fullscreenElement !== null) {
    return;
  }

  void document.documentElement.requestFullscreen().catch(() => undefined);
}

/** Fullscreen + pointer lock — call from a user gesture when possible (character pick, canvas click). */
export function enterArenaDisplayMode(canvas: HTMLCanvasElement): void {
  requestAppFullscreen();
  requestArenaPointerLock(canvas);
}

export function exitAppFullscreen(): void {
  if (document.fullscreenElement === null) {
    return;
  }

  void document.exitFullscreen().catch(() => undefined);
}
