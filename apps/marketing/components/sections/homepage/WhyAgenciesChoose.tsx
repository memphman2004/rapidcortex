import {
  ClipboardCheck,
  Handshake,
  Layers,
  Shield,
  SlidersHorizontal,
  UserCheck,
} from "lucide-react";

const TILES = [
  {
    title: "Human-in-the-loop design",
    body: "Every intelligent recommendation is reviewed and confirmed by a dispatcher before action is taken.",
    Icon: UserCheck,
  },
  {
    title: "CAD-agnostic integration",
    body: "NexCort iQ reads from and writes to your existing CAD — no forklift replacement required.",
    Icon: Layers,
  },
  {
    title: "Security-aware architecture",
    body: "Designed with CJIS considerations in mind. Data handling documented and transparent.",
    Icon: Shield,
  },
  {
    title: "Protocol respect",
    body: "Coaching and hints are framed as agency-aligned decision support — not autonomous dispatch.",
    Icon: Handshake,
  },
  {
    title: "Configurable by agency",
    body: "Modules activate based on your agency's configuration. Turn on what you need, when you're ready.",
    Icon: SlidersHorizontal,
  },
  {
    title: "Structured onboarding",
    body: "Every pilot includes defined scope, success criteria, and support — not a trial with no guardrails.",
    Icon: ClipboardCheck,
  },
] as const;

export function WhyAgenciesChoose() {
  return (
    <section className="bg-slate-950 px-4 py-20 sm:px-6 md:py-24" aria-labelledby="why-heading">
      <div className="mx-auto max-w-7xl">
        <h2
          id="why-heading"
          className="text-balance text-center text-3xl font-semibold tracking-tight text-white md:text-4xl lg:text-[2.75rem]"
        >
          Built for the professionals who protect communities.
        </h2>
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TILES.map((tile) => (
            <li
              key={tile.title}
              className="rounded-xl border border-slate-800 bg-slate-900/30 p-6"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-sky-500/25 bg-sky-500/10 text-sky-300">
                <tile.Icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-base font-semibold text-sky-200">{tile.title}</h3>
              <p className="mt-2 text-base leading-relaxed text-slate-400">{tile.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
