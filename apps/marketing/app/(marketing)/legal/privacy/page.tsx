import type { Metadata } from "next";
import PrivacyPolicyPage from "../../privacy/page";
import { buildPublicPageMetadata } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

/**
 * Ring Appstore and other reviewers check /legal/privacy/. Serve the same policy
 * body as /privacy (A2P canonical) so this URL is a real page, not a JS redirect.
 */
export const metadata: Metadata = buildPublicPageMetadata({
  title: "Privacy Policy | Rapid Cortex Public Safety Platform",
  description: `Learn how ${SITE_NAME} manages personal and operational information for public safety agencies, emergency communications teams, and platform users.`,
  path: "/legal/privacy",
});

export default PrivacyPolicyPage;
