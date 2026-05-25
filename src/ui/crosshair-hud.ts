const CROSSHAIR_HIT_FLASH_MS = 130;
const CROSSHAIR_KILL_FLASH_MS = 240;

export class CrosshairHud {
  readonly #root: HTMLDivElement;
  #flashTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(root: HTMLDivElement) {
    this.#root = root;
  }

  flashHit(): void {
    if (this.#root.dataset.kill === 'true') {
      return;
    }

    this.#setFlash(false, CROSSHAIR_HIT_FLASH_MS);
  }

  /** Stronger spread + red flash — any local-player kill, including off-screen. */
  flashKill(): void {
    this.#setFlash(true, CROSSHAIR_KILL_FLASH_MS);
  }

  #setFlash(kill: boolean, durationMs: number): void {
    this.#root.dataset.hit = 'true';
    if (kill) {
      this.#root.dataset.kill = 'true';
    }

    if (this.#flashTimeout !== null) {
      clearTimeout(this.#flashTimeout);
    }

    this.#flashTimeout = setTimeout(() => {
      delete this.#root.dataset.hit;
      delete this.#root.dataset.kill;
      this.#flashTimeout = null;
    }, durationMs);
  }
}
