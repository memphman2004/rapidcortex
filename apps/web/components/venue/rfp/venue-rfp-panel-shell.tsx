"use client";

import type { CSSProperties, ReactNode } from "react";

const panelStyle: CSSProperties = {
  background: "var(--rc-surface-alt)",
  border: "1px solid var(--rc-border)",
  borderRadius: 8,
  padding: 14,
  margin: "0 14px 14px",
};

export function VenueRfpPanelShell({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--rc-amber)" }}>{title}</h3>
        {actions}
      </div>
      {children}
    </section>
  );
}
