import { redirectDevelopersDocsToSignIn } from "@/lib/redirect-developers-docs-to-sign-in";

export const metadata = {
  title: "RC Lite API — Error catalogue",
  robots: { index: false, follow: false },
};

export default function DevelopersErrorCatalogPage() {
  redirectDevelopersDocsToSignIn("/developers/docs/errors");
}
