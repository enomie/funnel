// Path: /Users/johann/MyBrew/funnel-real/src/input/input-state.ts

import { PLAYER_CONFIG } from '../config/game-config';
import { requestArenaPointerLock } from './pointer-lock';

const MOVEMENT_KEYS = new Set<string>(['KeyW', 'KeyA', 'KeyS', 'KeyD']);

export interface InputSnapshot {
  movement: {
    forward: boolean;
    back: boolean;
    left: boolean;
    right: boolean;
  };
  jumpPressed: boolean;
  
  crouchHeld: boolean;
  sprintHeld: boolean;
  primaryHeld: boolean;
  primaryPressed: boolean;
  primaryReleased: boolean;
  secondaryHeld: boolean;
  secondaryPressed: boolean;
  secondaryReleased: boolean;
  
  firstPersonView: boolean;
  yaw: number;
  pitch: number;
  
  weaponSlotSelect: number | null;
  
  killPressed: boolean;

  reviveChannelHeld: boolean;

  teamFlipPressed: boolean;
}


export function applyPreMatchLookOnly(out: InputSnapshot): InputSnapshot {
  out.movement.forward = false;
  out.movement.back = false;
  out.movement.left = false;
  out.movement.right = false;
  out.jumpPressed = false;
  out.crouchHeld = false;
  out.sprintHeld = false;
  out.primaryHeld = false;
  out.primaryPressed = false;
  out.primaryReleased = false;
  out.secondaryHeld = false;
  out.secondaryPressed = false;
  out.secondaryReleased = false;
  out.weaponSlotSelect = null;
  out.killPressed = false;
  out.reviveChannelHeld = false;
  out.teamFlipPressed = false;
  return out;
}


export const IDLE_INPUT_SNAPSHOT: InputSnapshot = {
  movement: { forward: false, back: false, left: false, right: false },
  jumpPressed: false,
  crouchHeld: false,
  sprintHeld: false,
  primaryHeld: false,
  primaryPressed: false,
  primaryReleased: false,
  secondaryHeld: false,
  secondaryPressed: false,
  secondaryReleased: false,
  firstPersonView: true,
  yaw: Math.PI,
  pitch: -0.05,
  weaponSlotSelect: null,
  killPressed: false,
  reviveChannelHeld: false,
  teamFlipPressed: false
};

export class InputState {
  readonly #canvas: HTMLCanvasElement;
  readonly #keys = new Set<string>();
  #primaryHeld = false;
  #secondaryHeld = false;
  #firstPersonView = true;
  #primaryPressed = false;
  #primaryReleased = false;
  #secondaryPressed = false;
  #secondaryReleased = false;
  #jumpPressed = false;
  #killPressed = false;
  #teamFlipPressed = false;
  #yaw = Math.PI;
  #pitch = -0.05;
  #lookSensitivityScale = 1;
  #weaponSlotSelect: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.#canvas = canvas;
  }

  connect(): void {
    document.addEventListener('keydown', this.#onKeyDown);
    document.addEventListener('keyup', this.#onKeyUp);
    window.addEventListener('blur', this.#onBlur);
    this.#canvas.addEventListener('click', this.#requestPointerLock);
    this.#canvas.addEventListener('mousedown', this.#onMouseDown);
    window.addEventListener('mouseup', this.#onMouseUp);
    window.addEventListener('mousemove', this.#onMouseMove);
    this.#canvas.addEventListener('contextmenu', this.#preventContextMenu);
    requestArenaPointerLock(this.#canvas);
  }

  dispose(): void {
    document.removeEventListener('keydown', this.#onKeyDown);
    document.removeEventListener('keyup', this.#onKeyUp);
    window.removeEventListener('blur', this.#onBlur);
    this.#canvas.removeEventListener('click', this.#requestPointerLock);
    this.#canvas.removeEventListener('mousedown', this.#onMouseDown);
    window.removeEventListener('mouseup', this.#onMouseUp);
    window.removeEventListener('mousemove', this.#onMouseMove);
    this.#canvas.removeEventListener('contextmenu', this.#preventContextMenu);
  }

  reviveChannelHeldNow(): boolean {
    return this.#keys.has('KeyR');
  }

  /** Multiplier on `PLAYER_CONFIG.mouseSensitivity` (FOV zoom, etc.). */
  setLookSensitivityScale(scale: number): void {
    this.#lookSensitivityScale = Math.max(0.05, Math.min(1, scale));
  }

  get isFirstPersonView(): boolean {
    return this.#firstPersonView;
  }

  snapshot(out: InputSnapshot = this.#snapshotScratch): InputSnapshot {
    const forward = this.#keys.has('KeyW') ? 1 : 0;
    const back = this.#keys.has('KeyS') ? 1 : 0;
    const left = this.#keys.has('KeyA') ? 1 : 0;
    const right = this.#keys.has('KeyD') ? 1 : 0;
    const jumpPressed = this.#jumpPressed;
    const crouchHeld = this.#keys.has('KeyC');
    const killPressed = this.#killPressed;
    const teamFlipPressed = this.#teamFlipPressed;
    const primaryPressed = this.#primaryPressed;
    const primaryReleased = this.#primaryReleased;
    const secondaryPressed = this.#secondaryPressed;
    const secondaryReleased = this.#secondaryReleased;

    this.#jumpPressed = false;
    this.#killPressed = false;
    this.#teamFlipPressed = false;
    this.#primaryPressed = false;
    this.#primaryReleased = false;
    this.#secondaryPressed = false;
    this.#secondaryReleased = false;
    const weaponSlotSelect = this.#weaponSlotSelect;
    this.#weaponSlotSelect = null;

    out.movement.forward = forward === 1;
    out.movement.back = back === 1;
    out.movement.left = left === 1;
    out.movement.right = right === 1;
    out.jumpPressed = jumpPressed;
    out.crouchHeld = crouchHeld;
    out.sprintHeld = this.#keys.has('ShiftLeft') || this.#keys.has('ShiftRight');
    out.primaryHeld = this.#primaryHeld;
    out.primaryPressed = primaryPressed;
    out.primaryReleased = primaryReleased;
    out.secondaryHeld = this.#secondaryHeld;
    out.secondaryPressed = secondaryPressed;
    out.secondaryReleased = secondaryReleased;
    out.firstPersonView = this.#firstPersonView;
    out.yaw = this.#yaw;
    out.pitch = this.#pitch;
    out.weaponSlotSelect = weaponSlotSelect;
    out.killPressed = killPressed;
    out.reviveChannelHeld = this.#keys.has('KeyR');
    out.teamFlipPressed = teamFlipPressed;
    return out;
  }

  readonly #snapshotScratch: InputSnapshot = {
    movement: { forward: false, back: false, left: false, right: false },
    jumpPressed: false,
    crouchHeld: false,
    sprintHeld: false,
    primaryHeld: false,
    primaryPressed: false,
    primaryReleased: false,
    secondaryHeld: false,
    secondaryPressed: false,
    secondaryReleased: false,
    firstPersonView: true,
    yaw: Math.PI,
    pitch: -0.05,
    weaponSlotSelect: null,
    killPressed: false,
    reviveChannelHeld: false,
    teamFlipPressed: false
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Space' || event.code === 'Tab') {
      event.preventDefault();
    }

    if (MOVEMENT_KEYS.has(event.code) || event.code.startsWith('Shift')) {
      this.#keys.add(event.code);
    }

    if (event.code === 'Space' && !event.repeat) {
      this.#jumpPressed = true;
    }

    if (event.code === 'KeyP' && !event.repeat) {
      this.#togglePointerLock();
    }

    if (event.code.startsWith('Digit') && !event.repeat) {
      this.#selectWeaponSlot(event.code);
    }

    if (event.code === 'KeyC') {
      this.#keys.add('KeyC');
    }

    if (event.code === 'KeyV' && !event.repeat) {
      this.#firstPersonView = !this.#firstPersonView;
    }

    if (event.code === 'KeyK' && !event.repeat) {
      this.#killPressed = true;
    }

    if (event.code === 'KeyR') {
      event.preventDefault();
      this.#keys.add('KeyR');
    }

    if (event.code === 'KeyT' && !event.repeat) {
      this.#teamFlipPressed = true;
    }
  };

  #onKeyUp = (event: KeyboardEvent): void => {
    this.#keys.delete(event.code);
  };

  #onBlur = (): void => {
    this.#keys.clear();
    this.#primaryHeld = false;
    this.#secondaryHeld = false;
  };

  #onMouseDown = (event: MouseEvent): void => {
    if (event.button === 2) {
      event.preventDefault();
    }

    if (event.button === 0) {
      this.#primaryHeld = true;
      this.#primaryPressed = true;
    }

    if (event.button === 2) {
      this.#secondaryHeld = true;
      this.#secondaryPressed = true;
    }
  };

  #onMouseUp = (event: MouseEvent): void => {
    if (event.button === 0) {
      this.#primaryHeld = false;
      this.#primaryReleased = true;
    }

    if (event.button === 2) {
      this.#secondaryHeld = false;
      this.#secondaryReleased = true;
    }
  };

  #onMouseMove = (event: MouseEvent): void => {
    if (document.pointerLockElement !== this.#canvas) {
      return;
    }

    this.#yaw -= event.movementX * PLAYER_CONFIG.mouseSensitivity * this.#lookSensitivityScale;
    this.#pitch -= event.movementY * PLAYER_CONFIG.mouseSensitivity * this.#lookSensitivityScale;
    this.#pitch = Math.max(-1.2, Math.min(0.85, this.#pitch));
  };

  #requestPointerLock = (): void => {
    this.#safeRequestPointerLock();
  };

  #preventContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  #togglePointerLock(): void {
    if (document.pointerLockElement === this.#canvas) {
      document.exitPointerLock();
      return;
    }

    this.#safeRequestPointerLock();
  }

  #safeRequestPointerLock(): void {
    requestArenaPointerLock(this.#canvas);
  }

  #selectWeaponSlot(code: string): void {
    const digit = Number(code.slice('Digit'.length));
    if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
      return;
    }

    const index = digit === 0 ? 9 : digit - 1;
    this.#weaponSlotSelect = index;
  }
}
