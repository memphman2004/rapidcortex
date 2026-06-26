"use client";

import { useLayoutEffect } from "react";
import { hardNavigateTo } from "@/lib/auth/postAuthRedirect";

export default function PlatformIndexPage() {
  useLayoutEffect(() => {
    hardNavigateTo("/rc-admin/dashboard");
  }, []);
  return (
    <p className="text-sm text-slate-500">Opening platform command center…</p>
  );
}
