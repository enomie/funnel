import { PLAYER_CONFIG } from '../config/game-config';

export type BuildMode = 'wall' | 'floor' | 'ramp' | 'cone';
export type PlayerMode = 'weapon' | 'build';

const MOVEMENT_KEYS = new Set<string>(['KeyW', 'KeyA', 'KeyS', 'KeyD']);

export interface InputSnapshot {
  movement: {
    forward: boolean;
    back: boolean;
    left: boolean;
    right: boolean;
  };
  jumpPressed: boolean;
  crouchPressed: boolean;
  sprintHeld: boolean;
  fireHeld: boolean;
  aimHeld: boolean;
  yaw: number;
  pitch: number;
  mode: PlayerMode;
  buildMode: BuildMode;
  weaponSlot: number;
  consumePlacePressed: () => boolean;
  /** Dev/test: trigger death animation (`K`). */
  killPressed: boolean;
  /** Respawn after death (`R`). */
  respawnPressed: boolean;
}

export class InputState {
  readonly #canvas: HTMLCanvasElement;
  readonly #keys = new Set<string>();
  #fireHeld = false;
  #aimHeld = false;
  #jumpPressed = false;
  #crouchPressed = false;
  #placePressed = false;
  #killPressed = false;
  #respawnPressed = false;
  #yaw = Math.PI;
  #pitch = -0.05;
  #mode: PlayerMode = 'weapon';
  #buildMode: BuildMode = 'wall';
  #weaponSlot = 0;

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

  snapshot(): InputSnapshot {
    const forward = this.#keys.has('KeyW') ? 1 : 0;
    const back = this.#keys.has('KeyS') ? 1 : 0;
    const left = this.#keys.has('KeyA') ? 1 : 0;
    const right = this.#keys.has('KeyD') ? 1 : 0;
    const jumpPressed = this.#jumpPressed;
    const crouchPressed = this.#crouchPressed;
    const killPressed = this.#killPressed;
    const respawnPressed = this.#respawnPressed;

    this.#jumpPressed = false;
    this.#crouchPressed = false;
    this.#killPressed = false;
    this.#respawnPressed = false;

    return {
      movement: {
        forward: forward === 1,
        back: back === 1,
        left: left === 1,
        right: right === 1
      },
      jumpPressed,
      crouchPressed,
      sprintHeld: this.#keys.has('ShiftLeft') || this.#keys.has('ShiftRight'),
      fireHeld: this.#fireHeld,
      aimHeld: this.#aimHeld,
      yaw: this.#yaw,
      pitch: this.#pitch,
      mode: this.#mode,
      buildMode: this.#buildMode,
      weaponSlot: this.#weaponSlot,
      consumePlacePressed: () => {
        const placePressed = this.#placePressed;
        this.#placePressed = false;
        return placePressed;
      },
      killPressed,
      respawnPressed
    };
  }

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

    if (event.code === 'KeyF' && !event.repeat) {
      this.#mode = 'weapon';
    }

    if (event.code.startsWith('Digit') && !event.repeat) {
      this.#selectWeaponSlot(event.code);
    }

    if (event.code === 'KeyQ' && !event.repeat) {
      this.#setBuildMode('wall');
    }

    if (event.code === 'KeyZ' && !event.repeat) {
      this.#setBuildMode('floor');
    }

    if (event.code === 'KeyC' && !event.repeat) {
      this.#crouchPressed = true;
    }

    if (event.code === 'KeyK' && !event.repeat) {
      this.#killPressed = true;
    }

    if (event.code === 'KeyR' && !event.repeat) {
      this.#respawnPressed = true;
    }

    if (event.code === 'KeyV' && !event.repeat) {
      this.#setBuildMode('ramp');
    }

    if (event.code === 'Tab' && !event.repeat) {
      this.#setBuildMode('cone');
    }
  };

  #onKeyUp = (event: KeyboardEvent): void => {
    this.#keys.delete(event.code);

  };

  #onBlur = (): void => {
    this.#keys.clear();
    this.#fireHeld = false;
    this.#aimHeld = false;
    this.#crouchPressed = false;
  };

  #onMouseDown = (event: MouseEvent): void => {
    if (event.button === 0) {
      this.#fireHeld = true;
      this.#placePressed = true;
    }

    if (event.button === 2) {
      this.#aimHeld = true;
    }
  };

  #onMouseUp = (event: MouseEvent): void => {
    if (event.button === 0) {
      this.#fireHeld = false;
    }

    if (event.button === 2) {
      this.#aimHeld = false;
    }
  };

  #onMouseMove = (event: MouseEvent): void => {
    if (document.pointerLockElement !== this.#canvas) {
      return;
    }

    this.#yaw -= event.movementX * PLAYER_CONFIG.mouseSensitivity;
    this.#pitch -= event.movementY * PLAYER_CONFIG.mouseSensitivity;
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
    try {
      if (window.self !== window.top) {
        return;
      }

      void this.#canvas.requestPointerLock().catch(() => undefined);
    } catch {
      // Embedded browsers can reject pointer lock before returning a promise.
    }
  }

  #setBuildMode(mode: BuildMode): void {
    this.#mode = 'build';
    this.#buildMode = mode;
  }

  #selectWeaponSlot(code: string): void {
    const digit = Number(code.slice('Digit'.length));
    if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
      return;
    }

    this.#mode = 'weapon';
    this.#weaponSlot = digit === 0 ? 9 : digit - 1;
  }
}
