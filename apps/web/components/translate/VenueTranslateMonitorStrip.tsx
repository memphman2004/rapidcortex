"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Languages } from "lucide-react";
import type { TranslateSession } from "rapid-cortex-shared";
import { isRcTranslateEnabled, isRcTranslateVenueEnabled } from "@/lib/runtime-flags";
import { listTranslateSessions } from "@/lib/translate/translate-api";
import { V } from "@/lib/theme/rc-theme-tokens";

export function VenueTranslateMonitorStrip({
  venueCode,
  linkBase,
}: {
  venueCode: string;
  linkBase: string;
}) {
  const [items, setItems] = useState<TranslateSession[]>([]);

  useEffect(() => {
    if (!isRcTranslateEnabled() || !isRcTranslateVenueEnabled()) return;
    let cancelled = false;
    void listTranslateSessions({ status: "ACTIVE", vertical: "venue" })
      .then((res) => {
        if (!cancelled) setItems(res.items);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [venueCode]);

  if (!isRcTranslateEnabled() || !isRcTranslateVenueEnabled()) return null;

  return (
    <div style={{ padding: "0 16px 12px" }}>
      <div
        style={{
          border: `1px solid ${V.violetBorder}`,
          background: V.violetDim,
          borderRadius: 10,
          padding: "10px 14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <Languages size={14} color={V.violet} />
          <span style={{ fontSize: 12, fontWeight: 700, color: V.violet, letterSpacing: "0.05em" }}>
            RC TRANSLATE
          </span>
          <Link href={`${linkBase}/translate`} style={{ marginLeft: "auto", fontSize: 12, color: V.violet }}>
            Open
          </Link>
        </div>
        {items.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: V.textMuted }}>No live staff translation sessions.</p>
        ) : (
          <p style={{ margin: 0, fontSize: 12, color: V.textPrimary }}>
            {items.length} live session{items.length === 1 ? "" : "s"}
          </p>
        )}
      </div>
    </div>
  );
}
