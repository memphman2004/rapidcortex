"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { TranslateSession } from "rapid-cortex-shared";
import { listTranslateSessions } from "@/lib/translate/translate-api";
import { getTranslateTheme } from "@/lib/translate/translate-theme";

export function DispatchTranslateMonitor({
  jurisdiction,
}: {
  jurisdiction: string;
}) {
  const theme = getTranslateTheme("law_enforcement");
  const [items, setItems] = useState<TranslateSession[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void listTranslateSessions({ status: "ACTIVE", vertical: "law_enforcement" })
        .then((res) => {
          if (!cancelled) setItems(res.items);
        })
        .catch(() => {
          if (!cancelled) setItems([]);
        });
    };
    load();
    const id = window.setInterval(load, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return (
    <div style={{ padding: 20, background: theme.bg, minHeight: "60vh", color: theme.textPrimary }}>
      <h1 style={{ fontSize: 18, margin: "0 0 12px" }}>Live translation</h1>
      {items.length === 0 ? (
        <p style={{ color: theme.textMuted, fontSize: 13 }}>No officers in a translate session.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
          {items.map((s) => (
            <li key={s.sessionId}>
              <Link
                href={`/${jurisdiction}/translate/${s.sessionId}?monitor=1`}
                style={{
                  display: "block",
                  padding: 12,
                  borderRadius: 10,
                  border: `1px solid ${theme.border}`,
                  background: theme.surface,
                  color: theme.textPrimary,
                  textDecoration: "none",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.officerName || "Officer"}</div>
                <div style={{ fontSize: 11, color: theme.textMuted }}>
                  {s.subjectLanguage} · {s.segmentCount} exchanges · tap to monitor
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
