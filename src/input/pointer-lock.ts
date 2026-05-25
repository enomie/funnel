import { getRuntimeProfile } from '../platform/chrome-macos-arm-profile';

/** Must run synchronously inside a click/key user gesture. */
export function requestArenaPointerLock(canvas: HTMLCanvasElement): void {
  try {
    if (window.self !== window.top) {
      return;
    }

    if (document.pointerLockElement === canvas) {
      return;
    }

    const lockOptions = getRuntimeProfile().pointerLockUnadjustedMovement
      ? ({ unadjustedMovement: true } as const)
      : undefined;
    void canvas.requestPointerLock(lockOptions).catch(() => undefined);
  } catch {
    // Embedded browsers can reject pointer lock before returning a promise.
  }
}

export function exitArenaPointerLock(): void {
  if (document.pointerLockElement !== null) {
    document.exitPointerLock();
  }
}
