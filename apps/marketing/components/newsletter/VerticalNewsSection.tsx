import {
  VERTICAL_COLORS,
  VERTICAL_LABELS,
  type Vertical,
  type VerticalNews,
} from "@/lib/newsletter/newsletter-data";

const ORDER: Vertical[] = ["psap", "campus", "transit", "venue"];

export function VerticalNewsSection({ news }: { news: VerticalNews }) {
  return (
    <section className="mt-10">
      <h2 className="text-2xl font-semibold tracking-tight text-white">Across the Verticals</h2>
      <p className="mt-1 text-sm text-slate-400">
        What&apos;s happening in emergency communications this month
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {ORDER.map((v) => (
          <article
            key={v}
            className="rounded-lg border border-slate-800 bg-slate-900/50 p-4"
            style={{ borderLeftWidth: 4, borderLeftColor: VERTICAL_COLORS[v] }}
          >
            <p
              className="font-mono text-[11px] uppercase tracking-wider"
              style={{ color: VERTICAL_COLORS[v] }}
            >
              {VERTICAL_LABELS[v]}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{news[v]}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
