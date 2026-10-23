import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CardAnalytics } from "@/components/business-cards/card-analytics";
import { PublicCardActions } from "@/components/business-cards/public-card-actions";

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
  officeAddress?: { street?: string; city?: string; state?: string; postalCode?: string; country?: string };
  photoUrl?: string;
  coverUrl?: string;
  backgroundColor?: string;
  accentColor?: string;
  photoFocusX?: number;
  photoFocusY?: number;
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
  const theme = profile.cardTheme === "gold" || profile.cardTheme === "slate" || profile.cardTheme === "midnight" ? profile.cardTheme : "navy";
  const address = [profile.officeAddress?.street, profile.officeAddress?.city, profile.officeAddress?.state, profile.officeAddress?.postalCode, profile.officeAddress?.country].filter(Boolean).join(", ");
  const links = profile.socialLinks
    .filter((link) => link.url)
    .map((link) => ({
      label: link.label || (link.type === "linkedin" ? "LinkedIn" : link.type === "calendar" ? "Calendar" : "Link"),
      href: link.url,
      eventType: link.type === "linkedin" ? "linkedin_click" : link.type === "calendar" ? "calendar_click" : "web_click",
    }));
  return (
    <main className="min-h-screen bg-[#070612] text-white md:px-4 md:py-16">
      <h1 className="sr-only">{profile.displayName}</h1>
      <PublicCardActions
        publicProfileId={profile.publicProfileId}
        vcardHref={`/api/public/business-cards/${profile.publicProfileId}/contact.vcf`}
        name={profile.displayName}
        company={profile.companyName}
        title={profile.title}
        department={profile.department}
        biography={profile.biography}
        photoUrl={profile.photoUrl}
        coverUrl={profile.coverUrl}
        backgroundColor={profile.backgroundColor}
        accentColor={profile.accentColor}
        photoFocusX={profile.photoFocusX}
        photoFocusY={profile.photoFocusY}
        background={theme}
        phone={phone?.number}
        email={email?.address}
        website={profile.website}
        links={links}
        address={address}
        shareUrl={profile.permanentUrl || `https://www.nexcortiq.us/card/${profile.slug}`}
      />
      <Suspense fallback={null}>
        <CardAnalytics publicProfileId={profile.publicProfileId} />
      </Suspense>
    </main>
  );
}
