"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { CampusNav } from "./CampusNav";
import { CampusShellHeader } from "./CampusShellHeader";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { CampusK12Banner } from "@/components/campus/k12/CampusK12Banner";

const SHELL = {
  surface: "var(--rc-surface)",
  border: "var(--rc-border)",
} as const;

/**
 * Home (`/app/campus/{code}`) renders CampusConsoleHome full-bleed (map + campus photo).
 * Nested routes keep the compact shell chrome (header + sidebar).
 */
export function CampusShellChrome({
  campusCode,
  role,
  userEmail,
  agencyId,
  children,
}: {
  campusCode: string;
  role: string;
  userEmail?: string;
  agencyId: string;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const code = campusCode.toUpperCase();
  const base = `/app/campus/${code}`;
  const isConsoleHome =
    pathname === base || pathname === `${base}/` || pathname.toLowerCase() === base.toLowerCase();

  if (isConsoleHome) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-4 py-5">
      <CampusShellHeader
        campusCode={code}
        role={role}
        userEmail={userEmail}
        agencyId={agencyId}
        leadingSlot={<ThemeToggle variant="inline" />}
      />
      <CampusK12Banner agencyId={agencyId} />
      <div className="mt-4 flex flex-col gap-4 lg:flex-row">
        <CampusNav campusCode={campusCode} role={role} agencyId={agencyId} />
        <div
          className="min-w-0 flex-1 rounded-[10px] p-4"
          style={{
            background: SHELL.surface,
            border: `1px solid ${SHELL.border}`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
