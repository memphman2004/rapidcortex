import type { Metadata } from "next";
import AccountDeletionPage from "../../account-deletion/page";
import { buildPublicPageMetadata } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

/**
 * Play Console and some reviewers open /legal/account-deletion/. Serve the
 * same body as /account-deletion so this URL is a real page.
 */
export const metadata: Metadata = buildPublicPageMetadata({
  title: "Account deletion | NexCort iQ",
  description: `How to request deletion of a ${SITE_NAME} user account from the Android app or by email.`,
  path: "/legal/account-deletion",
});

export default AccountDeletionPage;
