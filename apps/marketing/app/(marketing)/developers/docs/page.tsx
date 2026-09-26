import { redirectDevelopersDocsToSignIn } from "@/lib/redirect-developers-docs-to-sign-in";

export const metadata = {
  title: "NexCort Lite — Documentation",
  robots: { index: false, follow: false },
};

export default function DevelopersDocsHubPage() {
  redirectDevelopersDocsToSignIn("/developers/docs");
}
