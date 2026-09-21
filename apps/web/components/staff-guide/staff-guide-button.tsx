"use client";

import Link from "next/link";
import { GraduationCap } from "lucide-react";

/** Header control for campus / venue / transit — not the 911 Help tab. */
export function StaffGuideHeaderButton({ href }: { href: string }) {
  return (
    <Link
      href={href}
      aria-label="Open staff guide and training"
      title="Staff Guide — unlimited training"
      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold tracking-wide no-underline transition-colors"
      style={{
        borderColor: "var(--rc-vertical-accent-border, #334155)",
        color: "var(--rc-vertical-accent, #94a3b8)",
      }}
    >
      <GraduationCap size={13} />
      Staff Guide
    </Link>
  );
}
