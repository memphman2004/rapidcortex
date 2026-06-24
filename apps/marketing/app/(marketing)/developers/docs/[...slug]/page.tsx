import { redirectDevelopersDocsToSignIn } from "@/lib/redirect-developers-docs-to-sign-in";

export const metadata = {
  title: "RC Lite — Documentation",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ slug: string[] }> };

/** Pre-render redirect stubs for static export (app host serves authenticated docs). */
export function generateStaticParams() {
  return [
    "authentication",
    "incident-intelligence",
    "cad-export",
    "transcription",
    "translation",
    "caller-links",
    "webhooks",
  ].map((slug) => ({ slug: [slug] }));
}

export default async function DevelopersDocPage({ params }: Props) {
  const { slug } = await params;
  const path = `/developers/docs/${(slug ?? []).join("/")}`;
  redirectDevelopersDocsToSignIn(path);
}
