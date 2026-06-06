"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { LanguageSelector } from "./LanguageSelector";

const venueNames: Record<string, string> = {
  MBS: "Mercedes-Benz Stadium",
};

export function ReportHeader() {
  const pathname = usePathname();

  const venueCode = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    if (segments[0] !== "report") return "";
    return (segments[1] ?? "").toUpperCase();
  }, [pathname]);

  const venueName = venueCode ? (venueNames[venueCode] ?? venueCode) : "";

  return (
    <header className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">Rapid Cortex</p>
        {venueName ? <p className="mt-1 text-sm font-medium text-slate-700">{venueName}</p> : null}
      </div>
      <LanguageSelector />
    </header>
  );
}
