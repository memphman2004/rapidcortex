import type { Metadata } from "next";
import TermsOfUsePage from "../../terms/page";
import { buildPublicPageMetadata } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

/**
 * Ring Appstore reviewers check /legal/terms/. Serve the same terms body as /terms
 * so this URL is a real page, not a client-side redirect stub.
 */
export const metadata: Metadata = buildPublicPageMetadata({
  title: "Terms of use | Rapid Cortex",
  description: `Terms governing use of the ${SITE_NAME} product and public websites.`,
  path: "/legal/terms",
});

export default TermsOfUsePage;
