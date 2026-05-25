// Path: /Users/johann/MyBrew/funnel-real/src/ui/status-toast.ts

export class StatusToast {
  readonly #element: HTMLDivElement;
  #timeoutId = 0;

  constructor(element: HTMLDivElement) {
    this.#element = element;
  }

  show(message: string, timeoutMs = 2800): void {
    window.clearTimeout(this.#timeoutId);
    this.#element.textContent = message;
    this.#element.dataset.visible = 'true';
    this.#timeoutId = window.setTimeout(() => {
      this.#element.dataset.visible = 'false';
    }, timeoutMs);
  }
}
