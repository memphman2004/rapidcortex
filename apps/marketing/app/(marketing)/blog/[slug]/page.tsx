import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAllSlugs,
  getPostBySlug,
  getRelatedPosts,
  formatDate,
} from "@/lib/blog/utils";
import { buildPostMetadata, buildPostJsonLd, buildBreadcrumbJsonLd } from "@/lib/blog/seo";
import { ContentBlocks } from "@/components/blog/ContentBlocks";
import { PostCard } from "@/components/blog/PostCard";

type PageParams = { slug: string };

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return buildPostMetadata(post);
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const related = getRelatedPosts(post);

  return (
    <div className="min-h-screen bg-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildPostJsonLd(post)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBreadcrumbJsonLd(post)) }}
      />

      <article className="px-6 py-12 md:py-16">
        <div className="mx-auto max-w-3xl">
          <nav aria-label="Breadcrumb" className="font-mono text-xs uppercase tracking-wider text-slate-500">
            <Link href="/" className="hover:text-slate-300">
              Home
            </Link>
            <span className="px-2" aria-hidden="true">
              /
            </span>
            <Link href="/blog" className="hover:text-slate-300">
              Blog
            </Link>
          </nav>

          <p className="mt-6 font-mono text-xs uppercase tracking-[0.15em] text-blue-400">
            {post.category}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
            {post.title}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-wider text-slate-500">
            <span>
              {post.author.name} · {post.author.role}
            </span>
            <span aria-hidden="true">·</span>
            <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
            <span aria-hidden="true">·</span>
            <span>{post.readingTimeMinutes} MIN READ</span>
          </div>

          <div className="mt-10 border-t border-slate-800 pt-10">
            <ContentBlocks blocks={post.content} />
          </div>

          <div className="mt-12 rounded-lg border border-slate-800 bg-slate-900/40 p-6">
            <p className="font-mono text-xs uppercase tracking-wider text-red-500">
              {post.cta?.eyebrow ?? "See it in your center"}
            </p>
            <p className="mt-2 text-slate-300">
              {post.cta?.text ??
                "Rapid Cortex enhances dispatch operations without replacing your CAD, telephony, or call-takers. Request a walkthrough scoped to your agency."}
            </p>
            <Link
              href={post.cta?.href ?? "/demo"}
              className="mt-4 inline-flex items-center text-sm font-medium text-blue-400 hover:text-blue-300"
            >
              {post.cta?.buttonLabel ?? "Request a demo"} →
            </Link>
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section className="border-t border-slate-800 px-6 py-12">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-mono text-xs uppercase tracking-wider text-slate-500">Related</h2>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {related.map((p) => (
                <PostCard key={p.slug} post={p} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
