import type { Metadata } from "next";
import { getPublishedPosts } from "@/lib/blog/utils";
import { SITE_URL, SITE_NAME } from "@/lib/blog/seo";
import { PostCard } from "@/components/blog/PostCard";
import { SoroBlogEmbed } from "@/components/blog/SoroBlogEmbed";

export const metadata: Metadata = {
  title: "Blog | Rapid Cortex",
  description:
    "Operational insight on 911 dispatch, campus safety, and venue operations — compliance and decision-support from the Rapid Cortex team",
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    type: "website",
    title: "Rapid Cortex Blog",
    description:
      "Operational insight on 911 dispatch, campus safety, and venue operations — compliance and decision-support.",
    url: `${SITE_URL}/blog`,
    siteName: SITE_NAME,
  },
};

export default function BlogIndexPage() {
  const posts = getPublishedPosts();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Rapid Cortex Blog",
    url: `${SITE_URL}/blog`,
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="border-b border-slate-800 px-6 py-16 md:py-20">
        <div className="mx-auto max-w-5xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-red-500">
            Rapid Cortex / Insights
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Field notes from the public safety frontline
          </h1>
          <p className="mt-4 max-w-2xl text-slate-400">
            Operational thinking on 911 dispatch, campus safety, and venue
            operations — technology, compliance, and decision-support written
            for the people who run command centers, campuses, and venues, not
            for marketing.
          </p>
        </div>
      </section>

      <section className="px-6 py-12 md:py-16" aria-label="Soro blog">
        <div className="mx-auto max-w-5xl">
          <SoroBlogEmbed />
        </div>
      </section>

      <section className="px-6 py-12 md:py-16">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      </section>
    </div>
  );
}
