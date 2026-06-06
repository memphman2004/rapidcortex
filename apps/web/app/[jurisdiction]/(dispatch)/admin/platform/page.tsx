"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect } from "react";
export default function PlatformIndexPage() {
  const router = useRouter();
  useLayoutEffect(() => {
    router.replace("/rc-admin/dashboard");
  }, [router]);
  return (
    <p className="text-sm text-slate-500">Opening platform command center…</p>
  );
}
