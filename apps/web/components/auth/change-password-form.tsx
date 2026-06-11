"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { COGNITO_PASSWORD_REQUIREMENTS, cognitoPasswordPolicyError, isValidCognitoPassword } from "@/lib/auth/cognito-password-policy";
import { postAuthRedirect } from "@/lib/auth/postAuthRedirect";
import { resolvePostAuthenticationHomeHrefAfterPasswordChange } from "@/lib/auth/post-login-redirect";
import { useSession } from "@/components/auth/session-context";
import { ensureCsrfCookie, jsonHeadersWithCsrf } from "@/lib/csrf-client";
import { defaultJurisdictionSlug } from "@/lib/marketing-links";
import { Eye, EyeOff } from "lucide-react";

type Props = {
  /** When false, shows a compact card (e.g. settings page). */
  showFullPageCopy?: boolean;
};

export function ChangePasswordForm({ showFullPageCopy = true }: Props) {
  const router = useRouter();
  const { user } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const homeHref = useMemo(() => {
    if (!user) return "/";
    return resolvePostAuthenticationHomeHrefAfterPasswordChange(user, defaultJurisdictionSlug());
  }, [user]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      await ensureCsrfCookie();
      if (newPassword !== confirmPassword) {
        setError("New password and confirmation do not match.");
        return;
      }
      if (!isValidCognitoPassword(newPassword)) {
        setError(cognitoPasswordPolicyError());
        return;
      }
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: jsonHeadersWithCsrf(),
        credentials: "include",
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
      if (!res.ok) {
        setSuccess(null);
        setError(body?.error ?? "Could not update your password.");
        return;
      }
      setSuccess(
        typeof body?.message === "string"
          ? body.message
          : "Password updated successfully. You're all set — your session remains active.",
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      window.setTimeout(() => {
        postAuthRedirect(router, homeHref);
      }, 1500);
    } finally {
      setSubmitting(false);
    }
  }

  const requirements = COGNITO_PASSWORD_REQUIREMENTS;

  return (
    <div className={`mx-auto w-full max-w-md ${showFullPageCopy ? "" : ""}`}>
      {showFullPageCopy ? (
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-semibold text-white">Password Update Required</h1>
            <Link href={homeHref} className="text-sm text-sky-400 hover:text-sky-300">
              Home
            </Link>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            For security, Rapid Cortex requires password updates every 60 days. Please create a new password to
            continue to your secure console.
          </p>
        </div>
      ) : (
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Change Password</h2>
          <p className="mt-2 text-sm text-slate-400">
            Change your Rapid Cortex password. For security, passwords must be updated every 60 days.
          </p>
        </div>
      )}

      <form className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/45 p-4" onSubmit={onSubmit}>
        {/* Do not nest the visibility toggle inside <label>: browsers mishandle label activation vs button clicks. */}
        <div className="flex flex-col gap-1 text-xs">
          <label htmlFor="change-password-current" className="text-slate-400">
            Current password
          </label>
          <div className="flex items-stretch overflow-hidden rounded-md border border-slate-700 bg-slate-950 focus-within:ring-2 focus-within:ring-sky-500">
            <button
              type="button"
              aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
              title={showCurrentPassword ? "Hide" : "Show"}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowCurrentPassword((v) => !v);
              }}
              className="relative z-10 flex shrink-0 cursor-pointer items-center justify-center border-r border-slate-700 bg-slate-900/70 px-2.5 text-slate-400 hover:bg-slate-900 hover:text-slate-200 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-500"
            >
              {showCurrentPassword ? (
                <EyeOff className="h-4 w-4 shrink-0 pointer-events-none" aria-hidden />
              ) : (
                <Eye className="h-4 w-4 shrink-0 pointer-events-none" aria-hidden />
              )}
            </button>
            <input
              id="change-password-current"
              type={showCurrentPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent py-2 pl-3 pr-3 text-sm text-slate-100 outline-none"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1 text-xs">
          <label htmlFor="change-password-new" className="text-slate-400">
            New password
          </label>
          <div className="flex items-stretch overflow-hidden rounded-md border border-slate-700 bg-slate-950 focus-within:ring-2 focus-within:ring-sky-500">
            <button
              type="button"
              aria-label={showNewPassword ? "Hide new password" : "Show new password"}
              title={showNewPassword ? "Hide" : "Show"}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowNewPassword((v) => !v);
              }}
              className="relative z-10 flex shrink-0 cursor-pointer items-center justify-center border-r border-slate-700 bg-slate-900/70 px-2.5 text-slate-400 hover:bg-slate-900 hover:text-slate-200 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-500"
            >
              {showNewPassword ? (
                <EyeOff className="h-4 w-4 shrink-0 pointer-events-none" aria-hidden />
              ) : (
                <Eye className="h-4 w-4 shrink-0 pointer-events-none" aria-hidden />
              )}
            </button>
            <input
              id="change-password-new"
              type={showNewPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent py-2 pl-3 pr-3 text-sm text-slate-100 outline-none"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1 text-xs">
          <label htmlFor="change-password-confirm" className="text-slate-400">
            Confirm new password
          </label>
          <div className="flex items-stretch overflow-hidden rounded-md border border-slate-700 bg-slate-950 focus-within:ring-2 focus-within:ring-sky-500">
            <button
              type="button"
              aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              title={showConfirmPassword ? "Hide" : "Show"}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowConfirmPassword((v) => !v);
              }}
              className="relative z-10 flex shrink-0 cursor-pointer items-center justify-center border-r border-slate-700 bg-slate-900/70 px-2.5 text-slate-400 hover:bg-slate-900 hover:text-slate-200 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-500"
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4 shrink-0 pointer-events-none" aria-hidden />
              ) : (
                <Eye className="h-4 w-4 shrink-0 pointer-events-none" aria-hidden />
              )}
            </button>
            <input
              id="change-password-confirm"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent py-2 pl-3 pr-3 text-sm text-slate-100 outline-none"
            />
          </div>
        </div>
        <p className="text-[11px] text-slate-500">{requirements}</p>
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-400">{success}</p> : null}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-60"
        >
          {submitting ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
