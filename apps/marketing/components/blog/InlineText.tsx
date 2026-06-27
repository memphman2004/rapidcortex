import Link from "next/link";
import type { ReactNode } from "react";

// Intentionally narrow: only matches internal paths starting with "/".
// Body copy uses [label](/path) so internal links live in context, in the
// sentence that earns them, instead of being bolted on as a link list.
const INTERNAL_LINK_PATTERN = /\[([^\]]+)\]\((\/[a-zA-Z0-9\-/]*)\)/g;

export function InlineText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  INTERNAL_LINK_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INTERNAL_LINK_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <Link
        key={key++}
        href={match[2]}
        className="text-blue-400 underline decoration-blue-400/40 underline-offset-2 transition-colors hover:text-blue-300"
      >
        {match[1]}
      </Link>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}
