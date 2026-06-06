import Link from "next/link";
import { MarketingArticleShell } from "@/components/marketing/marketing-article-shell";

export const metadata = {
  title: "RC Lite — Documentation",
  robots: { index: true, follow: true },
};

const SECTIONS = [
  ["authentication", "Authentication"],
  ["incident-intelligence", "Incident intelligence"],
  ["cad-export", "CAD export"],
  ["transcription", "Transcription"],
  ["translation", "Translation"],
  ["caller-links", "Caller links & media"],
  ["webhooks", "Webhooks"],
] as const;

export default function DevelopersDocsHubPage() {
  return (
    <MarketingArticleShell eyebrow="Docs" title="RC Lite API guides" sectionLabel="Developers · Docs">
      <ul className="space-y-3 text-sm text-sky-400/95">
        {SECTIONS.map(([slug, label]) => (
          <li key={slug}>
            <Link className="hover:text-sky-300 hover:underline" href={`/developers/docs/${slug}`}>
              {label} →
            </Link>
          </li>
        ))}
      </ul>
    </MarketingArticleShell>
  );
}
