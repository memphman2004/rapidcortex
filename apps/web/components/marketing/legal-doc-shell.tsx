import type { ReactNode } from "react";
import Link from "next/link";
import { marketingHomePath } from "@/lib/marketing-links";

type Props = {
  title: string;
  lastUpdated: string;
  children: ReactNode;
};

/**
 * Public marketing legal pages: desktop-first readable column, not legal advice.
 */
export function LegalDocShell({ title, lastUpdated, children }: Props) {
  const home = marketingHomePath();
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-xs text-slate-500">
        <Link href={home} className="text-sky-400/90 hover:text-sky-300">
          Home
        </Link>
        <span className="mx-2 text-slate-600">/</span>
        <span className="text-slate-400">Legal</span>
      </p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        {title}
      </h1>
      <p className="mt-1 text-sm text-slate-500">Last updated {lastUpdated}</p>
      <div className="mt-8 space-y-8 text-sm leading-relaxed text-slate-300 [&_a]:text-sky-400 [&_a]:underline-offset-2 hover:[&_a]:text-sky-300">
        {children}
      </div>
    </article>
  );
}
