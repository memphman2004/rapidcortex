/** Simple vertical DAG layout for feature architecture flowcharts. */

export type DagNodeInput = { id: string };
export type DagEdgeInput = { from: string; to: string };

export type DagLayoutNode = { id: string; x: number; y: number; width: number; height: number };
export type DagLayoutEdge = {
  from: string;
  to: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
};

export type DagLayoutResult = {
  nodes: DagLayoutNode[];
  edges: DagLayoutEdge[];
  width: number;
  height: number;
};

export function computeVerticalDagLayout(opts: {
  nodes: DagNodeInput[];
  edges: DagEdgeInput[];
  nodeWidth?: number;
  nodeHeight?: number;
  rankGap?: number;
  nodeGap?: number;
  padding?: number;
}): DagLayoutResult {
  const nodeWidth = opts.nodeWidth ?? 168;
  const nodeHeight = opts.nodeHeight ?? 52;
  const rankGap = opts.rankGap ?? 56;
  const nodeGap = opts.nodeGap ?? 28;
  const padding = opts.padding ?? 16;

  const ids = opts.nodes.map((n) => n.id);
  const idSet = new Set(ids);
  const outgoing = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  for (const id of ids) {
    outgoing.set(id, []);
    indegree.set(id, 0);
  }
  for (const e of opts.edges) {
    if (!idSet.has(e.from) || !idSet.has(e.to)) continue;
    outgoing.get(e.from)!.push(e.to);
    indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1);
  }

  const rank = new Map<string, number>();
  const queue = ids.filter((id) => (indegree.get(id) ?? 0) === 0);
  for (const id of queue) rank.set(id, 0);
  let qi = 0;
  while (qi < queue.length) {
    const cur = queue[qi++]!;
    const r = rank.get(cur) ?? 0;
    for (const next of outgoing.get(cur) ?? []) {
      const nextRank = Math.max(rank.get(next) ?? 0, r + 1);
      rank.set(next, nextRank);
      indegree.set(next, (indegree.get(next) ?? 1) - 1);
      if ((indegree.get(next) ?? 0) === 0) queue.push(next);
    }
  }
  for (const id of ids) {
    if (!rank.has(id)) rank.set(id, 0);
  }

  const ranks = new Map<number, string[]>();
  for (const id of ids) {
    const r = rank.get(id) ?? 0;
    const list = ranks.get(r) ?? [];
    list.push(id);
    ranks.set(r, list);
  }

  const maxRank = Math.max(0, ...Array.from(ranks.keys()));
  let maxRowWidth = 0;
  const pos = new Map<string, { x: number; y: number }>();

  for (let r = 0; r <= maxRank; r++) {
    const row = ranks.get(r) ?? [];
    const rowWidth = row.length * nodeWidth + Math.max(0, row.length - 1) * nodeGap;
    maxRowWidth = Math.max(maxRowWidth, rowWidth);
  }

  for (let r = 0; r <= maxRank; r++) {
    const row = ranks.get(r) ?? [];
    const rowWidth = row.length * nodeWidth + Math.max(0, row.length - 1) * nodeGap;
    const startX = padding + (maxRowWidth - rowWidth) / 2;
    const y = padding + r * (nodeHeight + rankGap);
    row.forEach((id, i) => {
      pos.set(id, { x: startX + i * (nodeWidth + nodeGap), y });
    });
  }

  const nodes: DagLayoutNode[] = ids.map((id) => {
    const p = pos.get(id) ?? { x: padding, y: padding };
    return { id, x: p.x, y: p.y, width: nodeWidth, height: nodeHeight };
  });

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const edges: DagLayoutEdge[] = [];
  for (const e of opts.edges) {
    const a = nodeMap.get(e.from);
    const b = nodeMap.get(e.to);
    if (!a || !b) continue;
    edges.push({
      from: e.from,
      to: e.to,
      sourceX: a.x + a.width / 2,
      sourceY: a.y + a.height,
      targetX: b.x + b.width / 2,
      targetY: b.y,
    });
  }

  return {
    nodes,
    edges,
    width: maxRowWidth + padding * 2,
    height: padding * 2 + (maxRank + 1) * nodeHeight + maxRank * rankGap,
  };
}
