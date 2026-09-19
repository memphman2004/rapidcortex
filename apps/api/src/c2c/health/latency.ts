export class LatencyTracker {
  private samples: number[] = [];
  constructor(private readonly capacity = 100) {}

  record(ms: number): void {
    this.samples.push(ms);
    if (this.samples.length > this.capacity) this.samples.shift();
  }

  percentile(p: number): number {
    if (!this.samples.length) return 0;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[idx] ?? 0;
  }

  get p50(): number {
    return this.percentile(50);
  }
  get p95(): number {
    return this.percentile(95);
  }
  get p99(): number {
    return this.percentile(99);
  }
}
