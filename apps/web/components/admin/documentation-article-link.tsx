"use client";

import { hostedDocHref, repoDocPath } from "@/lib/documentation-links";

export function DocumentationArticleLink({
  file,
  label,
  className,
}: {
  file: string;
  label?: string;
  className?: string;
}) {
  const href = hostedDocHref(file);
  const text = label ?? repoDocPath(file);
  const linkClass =
    className ??
    "text-sky-400 underline-offset-2 hover:text-sky-300 hover:underline";

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        {text}
      </a>
    );
  }

  return (
    <span className={className ?? "font-mono text-xs text-slate-400"} title="Repository path">
      {text}
    </span>
  );
}
