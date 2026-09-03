"use client";

import { useState } from "react";
import { useSession } from "@/components/auth/session-context";

/**
 * Ring certification: in-app account deletion for Ring Device Owner accounts.
 * Agency operator roles are not deleted from this control.
 */
export function RingDeleteAccountSection() {
  const { user } = useSession();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!user) {
    return null;
  }

  async function handleDeleteAccount() {
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/user/account", {
        method: "DELETE",
        credentials: "include",
      });
      const body = (await res.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;
      if (!res.ok || body?.success === false) {
        throw new Error(body?.error || "Deletion failed");
      }
      window.location.href = "/api/auth/signout";
    } catch (err) {
      setDeleteError(
        err instanceof Error && err.message && err.message !== "Deletion failed"
          ? err.message
          : "Unable to delete account. Please try again or contact support.",
      );
      setDeleteLoading(false);
    }
  }

  return (
    <div className="mt-8 border-t border-[#1e2433] pt-6">
      <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[#4a5568]">
        Account
      </div>
      {!showDeleteConfirm ? (
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="rounded-[5px] border border-[#7f1d1d] bg-transparent px-3.5 py-1.5 text-xs font-semibold text-[#fca5a5]"
        >
          Delete My Account
        </button>
      ) : (
        <div className="flex flex-col gap-2.5">
          <p className="m-0 text-xs text-[#9ca3af]">
            This will permanently delete your account and revoke all linked Ring devices. This action
            cannot be undone.
          </p>
          {deleteError ? <p className="m-0 text-xs text-[#fca5a5]">{deleteError}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleDeleteAccount()}
              disabled={deleteLoading}
              className="rounded-[5px] border-0 bg-[#7f1d1d] px-3.5 py-1.5 text-xs font-semibold text-[#fca5a5] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleteLoading ? "Deleting..." : "Yes, delete my account"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowDeleteConfirm(false);
                setDeleteError(null);
              }}
              className="rounded-[5px] border border-[#1e2433] bg-transparent px-3.5 py-1.5 text-xs font-semibold text-[#4a5568]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
