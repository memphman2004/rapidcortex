import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CardAnalytics } from "@/components/business-cards/card-analytics";

type PublicCard = {
  publicProfileId: string;
  slug: string;
  displayName: string;
  credentials?: string;
  title?: string;
  department?: string;
  companyName: string;
  biography?: string;
  phoneNumbers: Array<{ type: string; number: string }>;
  emailAddresses: Array<{ type: string; address: string }>;
  website?: string;
  socialLinks: Array<{ type: string; label?: string; url: string }>;
  photoUrl?: string;
  cardTheme: string;
  permanentUrl: string;
};

async function loadCard(slug: string): Promise<PublicCard | null> {
  const base = process.env.API_UPSTREAM_BASE?.replace(/\/$/, "");
  if (!base) return null;
  const response = await fetch(`${base}/api/public/business-cards/by-slug/${encodeURIComponent(slug)}`, {
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json() as Promise<PublicCard>;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const profile = await loadCard(slug);
  if (!profile) return { title: "Card Not Found" };
  return {
    title: `${profile.displayName} — ${profile.companyName}`,
    description: `${profile.title ?? "Contact"} at ${profile.companyName}`,
    openGraph: {
      title: profile.displayName,
      description: `${profile.title ?? "Contact"} · ${profile.companyName}`,
      images: [profile.photoUrl ?? "/og-default.png"],
      url: `https://www.nexcortiq.us/card/${profile.slug}`,
      type: "profile",
    },
    twitter: { card: "summary" },
  };
}

export default async function PublicCardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await loadCard(slug);
  if (!profile) notFound();
  const phone = profile.phoneNumbers[0];
  const email = profile.emailAddresses[0];
  const linkedin = profile.socialLinks.find((link) => link.type === "linkedin");
  const calendar = profile.socialLinks.find((link) => link.type === "calendar");
  return (
    <main className="min-h-screen bg-[#0d0d0f] px-4 py-8 text-[#f8f8f8]" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <article className="mx-auto w-full max-w-md">
        <p className="text-right text-xs tracking-wide text-[#c9a84c]">NexCort iQ</p>
        {profile.photoUrl ? (
          <img alt="" src={profile.photoUrl} className="mx-auto mt-6 h-24 w-24 rounded-full object-cover" />
        ) : (
          <div className="mx-auto mt-6 flex h-24 w-24 items-center justify-center rounded-full bg-white/10 text-xl">
            {profile.displayName.slice(0, 2).toUpperCase()}
          </div>
        )}
        <h1 className="mt-4 text-center text-2xl font-semibold">
          {profile.displayName}
          {profile.credentials ? <span className="text-white/60">, {profile.credentials}</span> : null}
        </h1>
        {profile.title ? <p className="text-center text-white/80">{profile.title}</p> : null}
        <p className="text-center text-[#c9a84c]">{profile.companyName}</p>
        {profile.department ? <p className="text-center text-sm text-white/60">{profile.department}</p> : null}
        {profile.biography ? <p className="mt-4 text-center text-sm text-white/80">{profile.biography}</p> : null}
        <a className="mt-6 flex min-h-11 items-center justify-center rounded-full bg-[#c9a84c] px-4 text-sm font-semibold text-[#0d0d0f]" href={`/api/public/business-cards/${profile.publicProfileId}/contact.vcf`}>
          Add to Contacts
        </a>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {phone ? <a className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/20 px-3" aria-label="Call" href={`tel:${phone.number}`}>Call</a> : null}
          {email ? <a className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/20 px-3" aria-label="Email" href={`mailto:${email.address}`}>Email</a> : null}
          {profile.website ? <a className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/20 px-3" aria-label="Website" href={profile.website}>Web</a> : null}
          {linkedin ? <a className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/20 px-3" aria-label="LinkedIn" href={linkedin.url}>LinkedIn</a> : null}
          {calendar ? <a className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/20 px-3" aria-label="Calendar" href={calendar.url}>Calendar</a> : null}
        </div>
        <div className="mt-6 space-y-2 text-sm text-white/80">
          {profile.phoneNumbers.map((item) => <p key={item.number}>{item.number}</p>)}
          {profile.emailAddresses.map((item) => <p key={item.address}>{item.address}</p>)}
        </div>
        <p className="mt-10 text-center text-xs text-white/50">Powered by NexCort iQ</p>
      </article>
      <Suspense fallback={null}>
        <CardAnalytics publicProfileId={profile.publicProfileId} />
      </Suspense>
    </main>
  );
}
