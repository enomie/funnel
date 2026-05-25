const HISTORY_SIZE = 96;
const UI_UPDATE_MS = 80;
const GRAPH_WIDTH = 128;
const GRAPH_HEIGHT = 28;
const SMOOTH_SAMPLE_COUNT = 8;
const REFERENCE_FPS = 60;

export interface FpsHudNodes {
  root: HTMLDivElement;
  value: HTMLSpanElement;
  canvas: HTMLCanvasElement;
}

export class FpsHud {
  readonly #root: HTMLDivElement;
  readonly #value: HTMLSpanElement;
  readonly #canvas: HTMLCanvasElement;
  readonly #ctx: CanvasRenderingContext2D;
  readonly #samples = new Float32Array(HISTORY_SIZE);
  #writeIndex = 0;
  #filled = 0;
  #lastUiMs = 0;

  constructor(nodes: FpsHudNodes) {
    this.#root = nodes.root;
    this.#value = nodes.value;
    this.#canvas = nodes.canvas;
    const context = this.#canvas.getContext('2d');
    if (context === null) {
      throw new Error('FUNNEL FPS HUD canvas context was not created.');
    }
    this.#ctx = context;
    this.#syncCanvasSize();
  }

  tick(frameMs: number, nowMs: number): void {
    const instantFps = frameMs > 0 ? 1000 / frameMs : 0;
    this.#samples[this.#writeIndex] = instantFps;
    this.#writeIndex = (this.#writeIndex + 1) % HISTORY_SIZE;
    if (this.#filled < HISTORY_SIZE) {
      this.#filled += 1;
    }

    if (nowMs - this.#lastUiMs < UI_UPDATE_MS) {
      return;
    }

    this.#lastUiMs = nowMs;

    const displayFps = Math.round(this.#averageRecentFps(instantFps));
    this.#value.textContent = String(displayFps);
    this.#root.dataset.tier = fpsTier(displayFps);
    this.#drawGraph();
  }

  #averageRecentFps(fallback: number): number {
    const count = Math.min(SMOOTH_SAMPLE_COUNT, this.#filled);
    if (count === 0) {
      return fallback;
    }

    let sum = 0;
    for (let offset = 0; offset < count; offset += 1) {
      const index = (this.#writeIndex - 1 - offset + HISTORY_SIZE) % HISTORY_SIZE;
      sum += this.#samples[index];
    }

    return sum / count;
  }

  #drawGraph(): void {
    const context = this.#ctx;
    const width = GRAPH_WIDTH;
    const height = GRAPH_HEIGHT;
    context.clearRect(0, 0, width, height);

    const count = this.#filled;
    if (count < 2) {
      return;
    }

    let maxFps = 30;
    for (let index = 0; index < count; index += 1) {
      const sampleIndex = (this.#writeIndex - count + index + HISTORY_SIZE) % HISTORY_SIZE;
      maxFps = Math.max(maxFps, this.#samples[sampleIndex]);
    }
    maxFps = Math.ceil(maxFps * 1.08);

    const points: { x: number; y: number }[] = [];
    for (let index = 0; index < count; index += 1) {
      const sampleIndex = (this.#writeIndex - count + index + HISTORY_SIZE) % HISTORY_SIZE;
      const x = count === 1 ? width : (index / (count - 1)) * width;
      const sample = this.#samples[sampleIndex];
      const y = height - (sample / maxFps) * (height - 2) - 1;
      points.push({ x, y });
    }

    const fillGradient = context.createLinearGradient(0, 0, 0, height);
    fillGradient.addColorStop(0, 'rgba(34, 93, 255, 0.38)');
    fillGradient.addColorStop(1, 'rgba(34, 93, 255, 0)');

    context.beginPath();
    context.moveTo(points[0].x, height);
    context.lineTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      context.lineTo(points[index].x, points[index].y);
    }
    context.lineTo(points[points.length - 1].x, height);
    context.closePath();
    context.fillStyle = fillGradient;
    context.fill();

    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      context.lineTo(points[index].x, points[index].y);
    }
    context.strokeStyle = 'rgba(158, 200, 255, 0.92)';
    context.lineWidth = 1.25;
    context.stroke();

    if (maxFps > REFERENCE_FPS) {
      const referenceY = height - (REFERENCE_FPS / maxFps) * (height - 2) - 1;
      if (referenceY > 1 && referenceY < height - 1) {
        context.strokeStyle = 'rgba(111, 138, 166, 0.38)';
        context.lineWidth = 1;
        context.setLineDash([2, 3]);
        context.beginPath();
        context.moveTo(0, referenceY);
        context.lineTo(width, referenceY);
        context.stroke();
        context.setLineDash([]);
      }
    }
  }

  #syncCanvasSize(): void {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.#canvas.width = Math.round(GRAPH_WIDTH * pixelRatio);
    this.#canvas.height = Math.round(GRAPH_HEIGHT * pixelRatio);
    this.#ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }
}

function fpsTier(fps: number): 'high' | 'mid' | 'low' {
  if (fps >= 100) {
    return 'high';
  }
  if (fps >= 55) {
    return 'mid';
  }
  return 'low';
}
