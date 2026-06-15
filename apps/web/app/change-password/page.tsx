import { ChangePasswordForm } from "@/components/auth/change-password-form";

/** Prevent CDN/intermediary caches from serving stale RSC shells for this auth flow. */
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ from?: string; next?: string }>;

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const redirectFrom = sp.from ?? sp.next ?? null;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-16 text-slate-100">
      <ChangePasswordForm showFullPageCopy redirectFrom={redirectFrom} />
    </div>
  );
}
