import Link from "next/link";
import { BookOpen, Newspaper, Wallet } from "lucide-react";

const RESOURCES = [
  {
    title: "How AI Is Transforming 911 Centers",
    body: "What AI-assisted dispatch intelligence looks like in real emergency communications workflows — without replacing CAD or dispatchers.",
    href: "/blog/ai-transforming-911-centers",
    label: "Read the article",
    Icon: BookOpen,
  },
  {
    title: "Grants for public safety technology",
    body: "Grant pathways and funding guidance to help agencies evaluate and procure modernization tools within budget cycles.",
    href: "/grants",
    label: "Explore grants",
    Icon: Wallet,
  },
  {
    title: "NexCortiQ Signal",
    body: "The NexCort iQ newsletter for public safety technology leaders — product updates, ops insights, and industry signals.",
    href: "/newsletter",
    label: "Browse Signal",
    Icon: Newspaper,
  },
] as const;

export function EducationalResources() {
  return (
    <section
      className="bg-slate-950 px-4 py-20 sm:px-6 md:py-24"
      aria-labelledby="resources-heading"
    >
      <div className="mx-auto max-w-7xl">
        <h2
          id="resources-heading"
          className="text-balance text-center text-3xl font-semibold tracking-tight text-white md:text-4xl lg:text-[2.75rem]"
        >
          Resources for public safety technology leaders
        </h2>
        <ul className="mt-12 grid gap-5 md:grid-cols-3">
          {RESOURCES.map((resource) => (
            <li key={resource.href}>
              <Link
                href={resource.href}
                className="group flex h-full min-h-[12rem] flex-col rounded-xl border border-slate-800 bg-slate-900/40 p-6 transition hover:border-slate-600 hover:bg-slate-900/70"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-sky-500/25 bg-sky-500/10 text-sky-300">
                  <resource.Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-white group-hover:text-sky-100">
                  {resource.title}
                </h3>
                <p className="mt-2 flex-1 text-base leading-relaxed text-slate-400">{resource.body}</p>
                <span className="mt-4 text-sm font-medium text-sky-400 group-hover:text-sky-300">
                  {resource.label} →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
