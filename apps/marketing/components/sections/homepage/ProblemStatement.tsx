import { MessageSquareWarning, PhoneIncoming, Users } from "lucide-react";

const TILES = [
  {
    icon: Users,
    title: "Dispatcher shortage",
    body: "Vacancy rates are rising. Remaining staff carry more calls, more stress, more risk.",
  },
  {
    icon: PhoneIncoming,
    title: "Call volume growth",
    body: "Non-emergency calls compete with life-safety calls on the same console.",
  },
  {
    icon: MessageSquareWarning,
    title: "NG911 is here",
    body: "Text, video, and media calls are arriving. Most dispatch centers aren't ready.",
  },
] as const;

export function ProblemStatement() {
  return (
    <section className="bg-slate-950 px-4 py-20 sm:px-6 md:py-24" aria-labelledby="problem-heading">
      <div className="mx-auto max-w-7xl">
        <h2
          id="problem-heading"
          className="rc-title-gradient text-balance text-center text-3xl font-semibold tracking-tight md:text-4xl lg:text-[2.75rem]"
        >
          The pressure on public safety teams is real
        </h2>
        <ul className="mt-12 grid gap-6 md:grid-cols-3">
          {TILES.map((tile) => (
            <li
              key={tile.title}
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-6"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-sky-500/25 bg-sky-500/10 text-sky-300">
                <tile.icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-sky-100">{tile.title}</h3>
              <p className="mt-2 text-base leading-relaxed text-slate-400">{tile.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
