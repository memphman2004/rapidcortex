import SwiftUI

/// Port of Android/marketing Enter the Cortex neural field (nodes, edges, traveling signals).
struct NeuralFieldView: View {
    @State private var engine = NeuralFieldBox()

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1.0 / 12.0)) { timeline in
            Canvas { context, size in
                engine.model.step(size: size, now: timeline.date.timeIntervalSinceReferenceDate)
                engine.model.draw(into: &context, size: size)
            }
        }
        .allowsHitTesting(false)
    }
}

private struct NeuralRGB {
    let r: Double
    let g: Double
    let b: Double

    static let blue = NeuralRGB(r: 59, g: 130, b: 246)
    static let red = NeuralRGB(r: 239, g: 68, b: 68)
    static let white = NeuralRGB(r: 255, g: 255, b: 255)

    func color(alpha: Double) -> Color {
        Color(red: r / 255, green: g / 255, blue: b / 255).opacity(alpha)
    }
}

private struct NeuralNode {
    var x: Double
    var y: Double
    var vx: Double
    var vy: Double
    var r: Double
    var phase: Double
    var speed: Double
    var col: NeuralRGB
}

private struct NeuralEdge {
    let i: Int
    let j: Int
    let d: Double
}

private struct NeuralSignal {
    var i: Int
    var j: Int
    var progress: Double
    var speed: Double
    var col: NeuralRGB
    var alpha: Double
    var tail: Double
    var rev: Bool
}

private struct NeuralFieldBox {
    let model = NeuralFieldEngine()
}

private final class NeuralFieldEngine {
    private var nodes: [NeuralNode] = []
    private var edges: [NeuralEdge] = []
    private var signals: [NeuralSignal] = []
    private var lastRebuild: Double = 0
    private var lastWidth: Double = 0
    private var lastHeight: Double = 0
    private var configured = false

    private let nodeCount = 48
    private let signalCount = 12
    private let maxEdgeRatio = 0.18

    func step(size: CGSize, now: Double) {
        guard size.width > 1, size.height > 1 else { return }
        if !configured || abs(Double(size.width) - lastWidth) > 40 || abs(Double(size.height) - lastHeight) > 40 {
            rebuild(size: size, now: now)
            configured = true
            lastWidth = Double(size.width)
            lastHeight = Double(size.height)
            return
        }

        let w = Double(size.width)
        let h = Double(size.height)
        for i in nodes.indices {
            nodes[i].phase += nodes[i].speed
            nodes[i].x += nodes[i].vx
            nodes[i].y += nodes[i].vy
            if nodes[i].x < -20 { nodes[i].x = w + 20 }
            if nodes[i].x > w + 20 { nodes[i].x = -20 }
            if nodes[i].y < -20 { nodes[i].y = h + 20 }
            if nodes[i].y > h + 20 { nodes[i].y = -20 }
        }

        var k = signals.count - 1
        while k >= 0 {
            signals[k].progress += signals[k].speed
            if signals[k].progress > 1 + signals[k].tail {
                signals.remove(at: k)
                spawnSignal()
            }
            k -= 1
        }

        if now - lastRebuild > 4 {
            rebuildEdges(width: w)
            lastRebuild = now
        }
    }

    func draw(into context: inout GraphicsContext, size: CGSize) {
        let edgeMax = Double(size.width) * maxEdgeRatio
        for e in edges {
            guard nodes.indices.contains(e.i), nodes.indices.contains(e.j) else { continue }
            let a = nodes[e.i]
            let b = nodes[e.j]
            let alpha = (1 - e.d / edgeMax) * 0.09
            var path = Path()
            path.move(to: CGPoint(x: a.x, y: a.y))
            path.addLine(to: CGPoint(x: b.x, y: b.y))
            context.stroke(path, with: .color(a.col.color(alpha: alpha)), lineWidth: 0.5)
        }

        for s in signals {
            let ai = s.rev ? s.j : s.i
            let bi = s.rev ? s.i : s.j
            guard nodes.indices.contains(ai), nodes.indices.contains(bi) else { continue }
            let a = nodes[ai]
            let b = nodes[bi]
            let headT = min(s.progress, 1)
            let tailT = max(0, s.progress - s.tail)
            let hx = a.x + headT * (b.x - a.x)
            let hy = a.y + headT * (b.y - a.y)
            let tx = a.x + tailT * (b.x - a.x)
            let ty = a.y + tailT * (b.y - a.y)
            var path = Path()
            path.move(to: CGPoint(x: tx, y: ty))
            path.addLine(to: CGPoint(x: hx, y: hy))
            context.stroke(
                path,
                with: .color(s.col.color(alpha: s.alpha * 0.7)),
                style: StrokeStyle(lineWidth: 1.5, lineCap: .round)
            )
        }

        for n in nodes {
            let pulse = 0.5 + 0.5 * sin(n.phase)
            let glow = CGRect(
                x: n.x - n.r * (1.8 + pulse),
                y: n.y - n.r * (1.8 + pulse),
                width: n.r * 2 * (1.8 + pulse),
                height: n.r * 2 * (1.8 + pulse)
            )
            context.fill(
                Path(ellipseIn: glow),
                with: .color(n.col.color(alpha: 0.12 + pulse * 0.15))
            )
            let core = CGRect(x: n.x - n.r, y: n.y - n.r, width: n.r * 2, height: n.r * 2)
            context.fill(Path(ellipseIn: core), with: .color(n.col.color(alpha: 0.75)))
        }
    }

    private func rebuild(size: CGSize, now: Double) {
        let w = Double(size.width)
        let h = Double(size.height)
        nodes = (0..<nodeCount).map { _ in
            NeuralNode(
                x: Double.random(in: 0...w),
                y: Double.random(in: 0...h),
                vx: Double.random(in: -0.09...0.09),
                vy: Double.random(in: -0.09...0.09),
                r: Double.random(in: 1.4...3.2),
                phase: Double.random(in: 0...(Double.pi * 2)),
                speed: Double.random(in: 0.01...0.022),
                col: randomColor()
            )
        }
        rebuildEdges(width: w)
        signals = []
        for _ in 0..<signalCount { spawnSignal() }
        lastRebuild = now
    }

    private func rebuildEdges(width: Double) {
        var next: [NeuralEdge] = []
        let maxD = width * maxEdgeRatio
        for i in 0..<nodes.count {
            for j in (i + 1)..<nodes.count {
                let d = hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y)
                if d < maxD {
                    next.append(NeuralEdge(i: i, j: j, d: d))
                }
            }
        }
        edges = next
    }

    private func spawnSignal() {
        guard let e = edges.randomElement() else { return }
        signals.append(
            NeuralSignal(
                i: e.i,
                j: e.j,
                progress: 0,
                speed: Double.random(in: 0.004...0.009),
                col: randomColor(),
                alpha: Double.random(in: 0.55...1),
                tail: Double.random(in: 0.2...0.35),
                rev: Bool.random()
            )
        )
    }

    private func randomColor() -> NeuralRGB {
        let roll = Double.random(in: 0...1)
        if roll < 0.55 { return .blue }
        if roll < 0.82 { return .red }
        return .white
    }
}
