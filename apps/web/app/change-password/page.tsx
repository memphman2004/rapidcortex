import { ChangePasswordForm } from "@/components/auth/change-password-form";

/** Prevent CDN/intermediary caches from serving stale RSC shells for this auth flow. */
export const dynamic = "force-dynamic";

export default function ChangePasswordPage() {
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-16 text-slate-100">
      <ChangePasswordForm showFullPageCopy />
    </div>
  );
}
