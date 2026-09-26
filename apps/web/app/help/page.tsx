import { redirect } from "next/navigation";

/**
 * Knowledge base entry — role-aware redirect into Help Chrome / static KB host.
 * Pass ?role=dispatcher|supervisor|agencyadmin|salescontractor to deep-link.
 * Full HTML KB artifact can be hosted at help.nexcortiq.us or public/help/.
 */
export default async function HelpIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const sp = await searchParams;
  const role = (sp.role ?? "").trim().toLowerCase();
  const qs = role ? `?role=${encodeURIComponent(role)}` : "";
  // Prefer in-app help when available; marketing help host as fallback path docs.
  redirect(`/docs/help/index.html${qs}`);
}
