// Path: /Users/johann/MyBrew/funnel-real/src/platform/browser-fullscreen.ts



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


export function initAppFullscreen(): void {
  if (escapeListenerBound) {
    return;
  }

  escapeListenerBound = true;
  document.addEventListener('keydown', onFullscreenEscapeKeyDown, { capture: true });
}


export function requestAppFullscreen(): void {
  if (document.fullscreenElement !== null) {
    return;
  }

  void document.documentElement.requestFullscreen().catch(() => undefined);
}


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
