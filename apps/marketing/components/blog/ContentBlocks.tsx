import type { ContentBlock } from "@/lib/blog/types";
import { InlineText } from "./InlineText";

export function ContentBlocks({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className="space-y-6">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "paragraph":
            return (
              <p key={i} className="leading-relaxed text-slate-300">
                <InlineText text={block.text} />
              </p>
            );

          case "heading": {
            const Tag = block.level === 2 ? "h2" : "h3";
            return (
              <Tag
                key={i}
                id={block.id}
                className={
                  block.level === 2
                    ? "scroll-mt-24 pt-2 text-2xl font-semibold tracking-tight text-white"
                    : "scroll-mt-24 pt-1 text-xl font-semibold text-white"
                }
              >
                {block.text}
              </Tag>
            );
          }

          case "list": {
            const ListTag = block.ordered ? "ol" : "ul";
            return (
              <ListTag key={i} className="space-y-3 pl-1 text-slate-300">
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-3">
                    {block.ordered ? (
                      <span className="mt-0.5 flex-none font-mono text-xs text-blue-400">
                        {String(j + 1).padStart(2, "0")}
                      </span>
                    ) : (
                      <span
                        className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-red-500"
                        aria-hidden="true"
                      />
                    )}
                    <span className="leading-relaxed">
                      <InlineText text={item} />
                    </span>
                  </li>
                ))}
              </ListTag>
            );
          }

          case "quote":
            return (
              <blockquote key={i} className="border-l-2 border-blue-500 pl-5 italic text-slate-300">
                <p>
                  <InlineText text={block.text} />
                </p>
                {block.attribution && (
                  <footer className="mt-2 font-mono text-xs not-italic uppercase tracking-wider text-slate-500">
                    — {block.attribution}
                  </footer>
                )}
              </blockquote>
            );

          case "callout": {
            const isCaution = block.tone === "caution";
            return (
              <div
                key={i}
                className={
                  isCaution
                    ? "rounded-md border border-red-500/30 bg-red-950/20 p-4"
                    : "rounded-md border border-blue-500/30 bg-blue-950/20 p-4"
                }
              >
                <p
                  className={
                    isCaution
                      ? "font-mono text-[11px] uppercase tracking-wider text-red-400"
                      : "font-mono text-[11px] uppercase tracking-wider text-blue-400"
                  }
                >
                  {block.label ?? (isCaution ? "Caution" : "Note")}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  <InlineText text={block.text} />
                </p>
              </div>
            );
          }

          default:
            return null;
        }
      })}
    </div>
  );
}
