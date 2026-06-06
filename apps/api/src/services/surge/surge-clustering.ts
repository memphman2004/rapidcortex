/** Disjoint-set union for incident id strings. */
export class UnionFind {
  private parent = new Map<string, string>();

  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    const p = this.parent.get(x)!;
    if (p !== x) this.parent.set(x, this.find(p));
    return this.parent.get(x)!;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }

  groups(ids: string[]): string[][] {
    const map = new Map<string, string[]>();
    for (const id of ids) {
      const r = this.find(id);
      const g = map.get(r) ?? [];
      g.push(id);
      map.set(r, g);
    }
    return [...map.values()];
  }
}
