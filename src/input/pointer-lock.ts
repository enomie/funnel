// Path: /Users/johann/MyBrew/funnel-real/src/input/pointer-lock.ts

import { getRuntimeProfile } from '../platform/chrome-macos-arm-profile';


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
    // Node may already be disconnected.
  }
}

export function exitArenaPointerLock(): void {
  if (document.pointerLockElement !== null) {
    document.exitPointerLock();
  }
}
