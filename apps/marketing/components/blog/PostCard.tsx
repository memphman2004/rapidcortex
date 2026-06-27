import Link from "next/link";
import type { BlogPost } from "@/lib/blog/types";
import { formatDateCompact } from "@/lib/blog/utils";

export function PostCard({ post }: { post: BlogPost }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col rounded-lg border border-slate-800 bg-slate-900/40 p-6 transition-colors hover:border-blue-500/50 hover:bg-slate-900"
    >
      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-slate-500">
        <span className="text-blue-400">{post.category}</span>
        <span aria-hidden="true">·</span>
        <span>{formatDateCompact(post.publishedAt)}</span>
        <span aria-hidden="true">·</span>
        <span>{post.readingTimeMinutes} MIN READ</span>
      </div>

      <h2 className="mt-3 text-xl font-semibold text-white transition-colors group-hover:text-red-400">
        {post.title}
      </h2>

      <p className="mt-2 line-clamp-3 text-sm text-slate-400">{post.description}</p>

      <span className="mt-4 text-sm font-medium text-blue-400">Read more →</span>
    </Link>
  );
}
