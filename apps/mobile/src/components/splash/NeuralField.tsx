import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { SplashColors } from '@/theme/splash';

type RGB = readonly [number, number, number];

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  phase: number;
  speed: number;
  col: RGB;
}

interface Edge {
  i: number;
  j: number;
  d: number;
}

interface Signal {
  ei: Edge;
  progress: number;
  speed: number;
  col: RGB;
  alpha: number;
  tail: number;
  rev: boolean;
}

function rnd(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function rgba(col: RGB, a: number) {
  return `rgba(${col[0]},${col[1]},${col[2]},${a})`;
}

const NODE_COUNT = 48;
const SIGNAL_COUNT = 12;
const MAX_EDGE_RATIO = 0.18;

/**
 * Neural field animation ported from marketing Enter the Cortex (`/enter`).
 * Uses SVG + rAF (lighter than a full canvas port on device).
 */
export function NeuralField() {
  const { width: W, height: H } = useWindowDimensions();
  const [tick, setTick] = useState(0);

  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const signalsRef = useRef<Signal[]>([]);
  const lastRebuildRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const rebuildEdges = (nodes: Node[], width: number) => {
    const edges: Edge[] = [];
    const maxD = width * MAX_EDGE_RATIO;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < maxD) edges.push({ i, j, d });
      }
    }
    edgesRef.current = edges;
  };

  const spawnSig = (edges: Edge[]) => {
    if (!edges.length) return;
    const e = edges[Math.floor(Math.random() * edges.length)]!;
    const col =
      Math.random() < 0.55
        ? SplashColors.blue
        : Math.random() < 0.55
          ? SplashColors.red
          : SplashColors.white;
    signalsRef.current.push({
      ei: e,
      progress: 0,
      speed: rnd(0.004, 0.009),
      col,
      alpha: rnd(0.55, 1),
      tail: rnd(0.2, 0.35),
      rev: Math.random() < 0.4,
    });
  };

  useEffect(() => {
    const nodes: Node[] = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      nodes.push({
        x: rnd(0, W),
        y: rnd(0, H),
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: rnd(1.4, 3.2),
        phase: rnd(0, Math.PI * 2),
        speed: rnd(0.01, 0.022),
        col:
          Math.random() < 0.55
            ? SplashColors.blue
            : Math.random() < 0.6
              ? SplashColors.red
              : SplashColors.white,
      });
    }
    nodesRef.current = nodes;
    rebuildEdges(nodes, W);
    signalsRef.current = [];
    for (let i = 0; i < SIGNAL_COUNT; i++) spawnSig(edgesRef.current);

    let frame = 0;
    const loop = (ts: number) => {
      const nodesNow = nodesRef.current;
      for (const n of nodesNow) {
        n.phase += n.speed;
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -20) n.x = W + 20;
        if (n.x > W + 20) n.x = -20;
        if (n.y < -20) n.y = H + 20;
        if (n.y > H + 20) n.y = -20;
      }

      const signals = signalsRef.current;
      for (let k = signals.length - 1; k >= 0; k--) {
        const s = signals[k]!;
        s.progress += s.speed;
        if (s.progress > 1 + s.tail) {
          signals.splice(k, 1);
          spawnSig(edgesRef.current);
        }
      }

      if (ts - lastRebuildRef.current > 4000) {
        rebuildEdges(nodesNow, W);
        lastRebuildRef.current = ts;
      }

      frame += 1;
      // ~5fps — full SVG redraws were starving the JS thread so taps felt dead
      if (frame % 12 === 0) setTick((t) => t + 1);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [W, H]);

  const edgeMax = W * MAX_EDGE_RATIO;

  const { edges, nodes, signals } = useMemo(() => {
    void tick;
    return {
      edges: edgesRef.current,
      nodes: nodesRef.current,
      signals: signalsRef.current,
    };
  }, [tick]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={W} height={H}>
        {edges.map((e, idx) => {
          const a = nodes[e.i];
          const b = nodes[e.j];
          if (!a || !b) return null;
          const al = (1 - e.d / edgeMax) * 0.09;
          return (
            <Line
              key={`e-${idx}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={rgba(a.col, al)}
              strokeWidth={0.5}
            />
          );
        })}

        {signals.map((s, idx) => {
          const a = s.rev ? nodes[s.ei.j] : nodes[s.ei.i];
          const b = s.rev ? nodes[s.ei.i] : nodes[s.ei.j];
          if (!a || !b) return null;
          const headT = Math.min(s.progress, 1);
          const tailT = Math.max(0, s.progress - s.tail);
          const hx = a.x + headT * (b.x - a.x);
          const hy = a.y + headT * (b.y - a.y);
          const tx = a.x + tailT * (b.x - a.x);
          const ty = a.y + tailT * (b.y - a.y);
          return (
            <Line
              key={`s-${idx}`}
              x1={tx}
              y1={ty}
              x2={hx}
              y2={hy}
              stroke={rgba(s.col, s.alpha * 0.7)}
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          );
        })}

        {nodes.map((n, idx) => {
          const pulse = 0.5 + 0.5 * Math.sin(n.phase);
          return (
            <Circle
              key={`n-${idx}`}
              cx={n.x}
              cy={n.y}
              r={n.r * (1.8 + pulse)}
              fill={rgba(n.col, 0.12 + pulse * 0.15)}
            />
          );
        })}
        {nodes.map((n, idx) => (
          <Circle
            key={`nc-${idx}`}
            cx={n.x}
            cy={n.y}
            r={n.r}
            fill={rgba(n.col, 0.75)}
          />
        ))}
      </Svg>
    </View>
  );
}
