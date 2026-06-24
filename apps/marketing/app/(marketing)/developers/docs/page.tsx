import { redirectDevelopersDocsToSignIn } from "@/lib/redirect-developers-docs-to-sign-in";

export const metadata = {
  title: "RC Lite — Documentation",
  robots: { index: false, follow: false },
};

export default function DevelopersDocsHubPage() {
  redirectDevelopersDocsToSignIn("/developers/docs");
}
