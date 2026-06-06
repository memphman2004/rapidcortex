import { redirect } from "next/navigation";

// TODO: remove after 2026-09-02 — legacy /caller deep links; canonical list view is /calls.
export default async function CallerPage({
  params,
}: {
  params: Promise<{ jurisdiction: string }>;
}) {
  const { jurisdiction } = await params;
  redirect(`/${jurisdiction}/calls`);
}
