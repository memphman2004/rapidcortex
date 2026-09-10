"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { TranslateSession, TranslateVertical } from "rapid-cortex-shared";
import { listTranslateSessions } from "@/lib/translate/translate-api";
import { getTranslateTheme } from "@/lib/translate/translate-theme";
import { TranslateSessionClient } from "./TranslateSessionClient";

export function TranslateHomeClient(props: {
  vertical: TranslateVertical;
  heading: string;
  sessionHref: (sessionId: string) => string;
  venueCode?: string;
  campusCode?: string;
  hospitalId?: string;
  incidentId?: string;
  /** Campus faculty and other monitor-only roles hide session create. */
  allowStart?: boolean;
}) {
  const theme = getTranslateTheme(props.vertical);
  const allowStart = props.allowStart !== false;
  const [items, setItems] = useState<TranslateSession[]>([]);
  const [compose, setCompose] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listTranslateSessions({ status: "ACTIVE", vertical: props.vertical })
      .then((res) => {
        if (!cancelled) setItems(res.items);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [props.vertical]);

  if (compose && allowStart) {
    return (
      <TranslateSessionClient
        vertical={props.vertical}
        heading={props.heading}
        createRequest={{
          vertical: props.vertical,
          incidentId: props.incidentId,
          venueContext: props.venueCode ? { venueCode: props.venueCode } : undefined,
          campusContext: props.campusCode ? { campusCode: props.campusCode } : undefined,
          hospitalContext: props.hospitalId ? { hospitalId: props.hospitalId } : undefined,
        }}
      />
    );
  }

  return (
    <div style={{ padding: 20, background: theme.bg, minHeight: "60vh", color: theme.textPrimary }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, margin: 0, flex: 1 }}>{props.heading}</h1>
        {allowStart ? (
          <button
            type="button"
            onClick={() => setCompose(true)}
            style={{
              background: theme.primaryColor,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "8px 12px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            New session
          </button>
        ) : (
          <span style={{ fontSize: 11, color: theme.textMuted }}>VIEW ONLY</span>
        )}
      </div>
      {items.length === 0 ? (
        <p style={{ color: theme.textMuted, fontSize: 13 }}>No active sessions.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
          {items.map((s) => (
            <li key={s.sessionId}>
              <Link
                href={props.sessionHref(s.sessionId)}
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
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.officerName || s.officerId}</div>
                <div style={{ fontSize: 11, color: theme.textMuted }}>
                  {s.subjectLanguage} · {s.status} · {s.segmentCount} exchanges
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
