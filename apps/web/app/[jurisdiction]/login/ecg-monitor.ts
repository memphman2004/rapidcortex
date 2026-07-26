/**
 * Canvas cardiac monitor — realistic Lead II PQRST (~72 BPM) with sweep-and-erase.
 * Visual model: sum of gaussians (sharp R, broad T, long TP baseline).
 */

export type EcgMonitorOptions = {
  /** Sweep speed in canvas pixels per second (CSS px if canvas is sized 1:1). Default 200. */
  speed?: number;
  bpm?: number;
  lineColor?: string;
  glowColor?: string;
  glowBlur?: number;
  lineWidth?: number;
  bgColor?: string;
  eraseLead?: number;
};

export class EcgMonitor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private raf: number | null = null;
  private cursor = 0;
  private totalSeconds = 0;
  private lastTs: number | null = null;
  private ecgTable: Float32Array;

  readonly speed: number;
  readonly bpm: number;
  readonly lineColor: string;
  readonly glowColor: string;
  readonly glowBlur: number;
  readonly lineWidth: number;
  readonly bgColor: string;
  readonly gridMajor = 25;
  readonly gridMinor = 5;
  readonly eraseLead: number;

  private get cycleSeconds() {
    return 60 / this.bpm;
  }

  constructor(canvas: HTMLCanvasElement, options: EcgMonitorOptions = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    this.ctx = ctx;
    this.speed = options.speed ?? 200;
    this.bpm = options.bpm ?? 72;
    this.lineColor = options.lineColor ?? "#22c55e";
    this.glowColor = options.glowColor ?? "#22c55e";
    this.glowBlur = options.glowBlur ?? 5;
    this.lineWidth = options.lineWidth ?? 1.6;
    this.bgColor = options.bgColor ?? "#060c06";
    this.eraseLead = options.eraseLead ?? 22;
    this.ecgTable = this.buildTable();
    this.drawBackground();
  }

  private static gaussian(x: number, mu: number, sigma: number): number {
    return Math.exp(-0.5 * ((x - mu) / sigma) ** 2);
  }

  private ecgValue(phase: number): number {
    const g = EcgMonitor.gaussian;
    const t = phase;
    const noise = (Math.random() - 0.5) * 0.007;

    return (
      0.14 * g(t, 0.1, 0.024) +
      -0.07 * g(t, 0.205, 0.009) +
      1.0 * g(t, 0.235, 0.007) +
      -0.22 * g(t, 0.265, 0.013) +
      0.24 * g(t, 0.44, 0.048) +
      0.04 * g(t, 0.56, 0.025) +
      noise
    );
  }

  private buildTable(): Float32Array {
    const n = 2000;
    const table = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      table[i] = this.ecgValue(i / n);
    }
    return table;
  }

  private samplePhase(phase: number): number {
    const idx = Math.floor((((phase % 1) + 1) % 1) * this.ecgTable.length);
    return this.ecgTable[Math.min(idx, this.ecgTable.length - 1)] ?? 0;
  }

  private drawBackground(x = 0, w?: number): void {
    const { ctx, canvas, bgColor, gridMajor, gridMinor } = this;
    const W = canvas.width;
    const H = canvas.height;
    if (W < 1 || H < 1) return;
    const drawW = w ?? W;

    ctx.fillStyle = bgColor;
    ctx.fillRect(x, 0, drawW + 1, H);

    ctx.lineWidth = 0.5;
    const startX = Math.floor(x / gridMajor) * gridMajor;
    for (let gx = startX; gx <= x + drawW + gridMajor; gx += gridMajor) {
      ctx.strokeStyle = "#0c210c";
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, H);
      ctx.stroke();
    }
    for (let gy = 0; gy <= H; gy += gridMajor) {
      ctx.strokeStyle = "#0c210c";
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(Math.min(x + drawW + 1, W), gy);
      ctx.stroke();
    }

    for (let gx = startX; gx <= x + drawW + gridMinor; gx += gridMinor) {
      if (gx % gridMajor !== 0) {
        ctx.strokeStyle = "#09180a";
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, H);
        ctx.stroke();
      }
    }
    for (let gy = 0; gy <= H; gy += gridMinor) {
      if (gy % gridMajor !== 0) {
        ctx.strokeStyle = "#09180a";
        ctx.beginPath();
        ctx.moveTo(x, gy);
        ctx.lineTo(Math.min(x + drawW + 1, W), gy);
        ctx.stroke();
      }
    }
  }

  private eraseAhead(cursorX: number): void {
    const W = this.canvas.width;
    const lead = this.eraseLead;
    if (cursorX + lead <= W) {
      this.drawBackground(cursorX, lead);
      return;
    }
    this.drawBackground(cursorX, W - cursorX);
    this.drawBackground(0, lead - (W - cursorX));
  }

  private strokeSegment(
    fromX: number,
    toX: number,
    t0: number,
    t1: number,
    baseline: number,
    amplitude: number,
  ): void {
    const { ctx } = this;
    const span = toX - fromX;
    if (span <= 0) return;
    const steps = Math.max(2, Math.ceil(span));

    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      const xPos = fromX + span * frac;
      const t = t0 + (t1 - t0) * frac;
      const phase = (t / this.cycleSeconds) % 1;
      const y = baseline - this.samplePhase(phase) * amplitude;
      if (i === 0) ctx.moveTo(xPos, y);
      else ctx.lineTo(xPos, y);
    }
    ctx.stroke();
  }

  private frame = (ts: number): void => {
    if (!this.lastTs) {
      this.lastTs = ts;
      this.raf = requestAnimationFrame(this.frame);
      return;
    }

    const dt = Math.min((ts - this.lastTs) / 1000, 0.05);
    this.lastTs = ts;
    this.totalSeconds += dt;

    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    if (W < 1 || H < 1) {
      this.raf = requestAnimationFrame(this.frame);
      return;
    }

    const baseline = H * 0.52;
    const amplitude = H * 0.38;

    const prevX = this.cursor;
    const advance = this.speed * dt;
    const nextX = prevX + advance;
    this.cursor = nextX % W;

    this.eraseAhead(this.cursor);

    ctx.save();
    ctx.strokeStyle = this.lineColor;
    ctx.lineWidth = this.lineWidth;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowColor = this.glowColor;
    ctx.shadowBlur = this.glowBlur;

    const tStart = this.totalSeconds - dt;
    const tEnd = this.totalSeconds;

    if (nextX <= W) {
      this.strokeSegment(prevX, nextX, tStart, tEnd, baseline, amplitude);
    } else {
      const fracToEdge = (W - prevX) / advance;
      const tMid = tStart + dt * fracToEdge;
      this.strokeSegment(prevX, W, tStart, tMid, baseline, amplitude);
      this.strokeSegment(0, this.cursor, tMid, tEnd, baseline, amplitude);
    }

    const tipPhase = (this.totalSeconds / this.cycleSeconds) % 1;
    const tipY = baseline - this.samplePhase(tipPhase) * amplitude;
    ctx.beginPath();
    ctx.arc(this.cursor, tipY, 2, 0, Math.PI * 2);
    ctx.fillStyle = "#86efac";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#86efac";
    ctx.fill();

    ctx.restore();
    this.raf = requestAnimationFrame(this.frame);
  };

  resize(): void {
    this.cursor = Math.min(this.cursor, Math.max(0, this.canvas.width - 1));
    this.drawBackground();
  }

  start(): void {
    if (this.raf !== null) return;
    this.lastTs = null;
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    if (this.raf !== null) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
  }
}
