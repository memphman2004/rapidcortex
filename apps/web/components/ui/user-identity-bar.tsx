"use client";

import { useEffect, useRef, useState } from "react";
import { isRapidCortexRole, migrateLegacyRapidCortexRoleTokenValue, ROLE_LABELS } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import { signOutFromClient } from "@/lib/auth/sign-out-client";
import {
  clearAccountAvatar,
  readAccountAvatar,
  writeAccountAvatar,
} from "@/lib/account/account-picture";
import { getRoleDashboardIdentity } from "@/lib/dashboards/role-dashboard-design";
import { getRoleHeaderBadgeLabel } from "@/lib/dashboards/role-header-badge";

export interface UserIdentityBarProps {
  email: string;
  role: string;
  agencyId?: string;
  userId?: string;
  roleLabel?: string;
}

export function UserIdentityBar({ email, role, userId, roleLabel }: UserIdentityBarProps) {
  const [signingOut, setSigningOut] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAvatarUrl(readAccountAvatar(userId));
    if (!userId) return;
    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string }>).detail;
      if (detail?.userId && detail.userId !== userId) return;
      setAvatarUrl(readAccountAvatar(userId));
    };
    window.addEventListener("rc-account-avatar-changed", onChanged);
    return () => window.removeEventListener("rc-account-avatar-changed", onChanged);
  }, [userId]);

  async function handleSignOut() {
    setSigningOut(true);
    await signOutFromClient();
  }

  const effective = migrateLegacyRapidCortexRoleTokenValue(role.trim()) ?? role.trim();
  const displayRole =
    roleLabel ??
    (isRapidCortexRole(effective) ? ROLE_LABELS[effective] : ROLE_LABELS[effective] ?? effective);
  const displayName = email.split("@")[0] ?? email;
  const initials = displayName.slice(0, 2).toUpperCase();
  const palette = getRoleDashboardIdentity("rc-admin", effective);
  const headerBadge = getRoleHeaderBadgeLabel(effective);

  function onPickFile(file: File | undefined) {
    if (!file || !userId) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result !== "string") return;
      writeAccountAvatar(userId, result);
      setAvatarUrl(result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex items-center gap-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onPickFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        title={userId ? "Change profile picture" : undefined}
        disabled={!userId}
        onClick={() => fileRef.current?.click()}
        onContextMenu={(e) => {
          if (!userId || !avatarUrl) return;
          e.preventDefault();
          clearAccountAvatar(userId);
          setAvatarUrl(null);
        }}
        className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold uppercase disabled:cursor-default"
        style={{
          backgroundColor: avatarUrl
            ? undefined
            : "color-mix(in srgb, var(--role-badge-bg) 55%, rgb(2 6 23))",
          color: "var(--role-text-accent)",
          backgroundImage: avatarUrl ? `url(${JSON.stringify(avatarUrl)})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        aria-label={userId ? "Change profile picture" : "Account"}
      >
        {avatarUrl ? null : initials}
      </button>

      <div className="hidden min-w-0 flex-col sm:flex">
        <span className="max-w-[160px] truncate text-[11px] font-semibold text-slate-200">{email}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">{displayRole}</span>
          {headerBadge ? (
            <span
              className="rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
              style={{
                borderColor: `color-mix(in srgb, ${palette.badgeBg} 70%, transparent)`,
                backgroundColor: `color-mix(in srgb, ${palette.badgeBg} 35%, rgb(2 6 23))`,
                color: palette.textColor,
              }}
            >
              {headerBadge}
            </span>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={() => void handleSignOut()}
        disabled={signingOut}
        className="rounded border border-slate-700/60 bg-slate-800/60 px-2.5 py-1 text-[11px] font-medium text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200 disabled:opacity-50"
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
