import { VERTICAL_COLORS, VERTICAL_LABELS, type Vertical } from "@/lib/newsletter/newsletter-data";

const ORDER: Vertical[] = ["psap", "campus", "transit", "venue"];

export function NewsletterHero() {
  return (
    <section className="border-b border-slate-800 px-6 py-16 md:py-20" style={{ background: "#0A1628" }}>
      <div className="mx-auto max-w-5xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-sky-400">
          NexCortiQ / Newsletter
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
          The NexCortiQ Signal
        </h1>
        <p className="mt-4 max-w-2xl text-slate-400">
          Monthly Intelligence for 911, Campus, Transit &amp; Venue Safety Professionals
        </p>
        <ul className="mt-8 flex flex-wrap gap-2">
          {ORDER.map((v) => (
            <li
              key={v}
              className="rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-white"
              style={{ borderColor: VERTICAL_COLORS[v], color: VERTICAL_COLORS[v] }}
            >
              {VERTICAL_LABELS[v]}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
