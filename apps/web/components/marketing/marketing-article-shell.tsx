import type { ReactNode } from "react";
import Link from "next/link";
import { marketingHomePath } from "@/lib/marketing-links";

type Props = {
  title: string;
  eyebrow?: string;
  sectionLabel?: string;
  children: ReactNode;
};

/** Public marketing article column (non-legal pages). */
export function MarketingArticleShell({
  title,
  eyebrow,
  sectionLabel = "Product",
  children,
}: Props) {
  const home = marketingHomePath();
  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
      <p className="text-xs text-slate-500">
        <Link href={home} className="text-sky-400/90 hover:text-sky-300">
          Home
        </Link>
        <span className="mx-2 text-slate-600">/</span>
        <span className="text-slate-400">{sectionLabel}</span>
      </p>
      {eyebrow ? (
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-sky-400/90">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white xs:text-3xl sm:text-4xl">{title}</h1>
      <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-300 [&_a]:text-sky-400 [&_a]:underline-offset-2 hover:[&_a]:text-sky-300 [&_ul]:list-inside [&_ul]:list-disc [&_ul]:space-y-2 [&_strong]:font-medium [&_strong]:text-slate-200">
        {children}
      </div>
    </article>
  );
}
