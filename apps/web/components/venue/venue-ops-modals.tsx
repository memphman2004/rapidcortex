"use client";

import { useState } from "react";
import type { VenueNotificationBody } from "rapid-cortex-shared";
import { postVenueNotification } from "@/lib/venue/venue-dashboard-api";

const V = {
  surface: "#100e1a",
  border: "#1e1a30",
  amber: "#f59e0b",
  red: "#ef4444",
  textPrimary: "#e4dff5",
  textSecondary: "#5a4d7a",
};

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: V.surface,
          border: `1px solid ${V.border}`,
          borderRadius: 8,
          padding: 16,
          width: 400,
          maxWidth: "92vw",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <strong style={{ color: V.textPrimary, fontSize: 14 }}>{title}</strong>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: V.textSecondary, cursor: "pointer" }}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function CreateVenueIncidentModal({
  venueCode,
  onClose,
  onCreated,
}: {
  venueCode: string;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/venue/incidents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          venueCode,
          zoneCode: "GENERAL",
          type: "security",
          source: "manual",
          description: "Manual incident created from venue operations center",
        }),
      });
      if (!res.ok) throw new Error(`Create failed (${res.status})`);
      onCreated?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create incident");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title="New incident" onClose={onClose}>
      <p style={{ color: V.textSecondary, fontSize: 12, marginTop: 0 }}>
        Creates a manual security incident for the venue operations queue.
      </p>
      {error ? <p style={{ color: V.red, fontSize: 11 }}>{error}</p> : null}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
        <button type="button" onClick={onClose} style={{ fontSize: 12 }}>Cancel</button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          style={{
            fontSize: 12,
            fontWeight: 700,
            background: V.amber,
            color: "#000",
            border: "none",
            borderRadius: 6,
            padding: "6px 12px",
            cursor: "pointer",
          }}
        >
          {busy ? "Creating…" : "Create incident"}
        </button>
      </div>
    </ModalShell>
  );
}

export function NotifyStaffModal({
  agencyId,
  onClose,
}: {
  agencyId: string;
  onClose: () => void;
}) {
  const [audience, setAudience] = useState<VenueNotificationBody["audience"]>("all_security");
  const [sectionId, setSectionId] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<VenueNotificationBody["priority"]>("standard");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!message.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await postVenueNotification(agencyId, {
        audience,
        message: message.trim(),
        priority,
        sectionId: audience === "by_section" ? sectionId : undefined,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title="Notify staff" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <select
          value={audience}
          onChange={(e) => setAudience(e.target.value as VenueNotificationBody["audience"])}
          style={{ padding: 8, fontSize: 12, background: "#141220", color: V.textPrimary, border: `1px solid ${V.border}`, borderRadius: 6 }}
        >
          <option value="all_security">All security</option>
          <option value="by_section">By section</option>
          <option value="by_gate">By gate</option>
        </select>
        {audience === "by_section" ? (
          <input
            placeholder="Section ID"
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            style={{ padding: 8, fontSize: 12, background: "#141220", color: V.textPrimary, border: `1px solid ${V.border}`, borderRadius: 6 }}
          />
        ) : null}
        <textarea
          rows={4}
          placeholder="Message to staff…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={{ padding: 8, fontSize: 12, background: "#141220", color: V.textPrimary, border: `1px solid ${V.border}`, borderRadius: 6 }}
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as VenueNotificationBody["priority"])}
          style={{ padding: 8, fontSize: 12, background: "#141220", color: V.textPrimary, border: `1px solid ${V.border}`, borderRadius: 6 }}
        >
          <option value="standard">Standard</option>
          <option value="emergency">Emergency</option>
        </select>
        {error ? <p style={{ color: V.red, fontSize: 11, margin: 0 }}>{error}</p> : null}
        <button
          type="button"
          disabled={busy || !message.trim()}
          onClick={() => void submit()}
          style={{
            padding: 10,
            background: V.amber,
            color: "#000",
            border: "none",
            borderRadius: 6,
            fontWeight: 700,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          {busy ? "Sending…" : "Send notification"}
        </button>
      </div>
    </ModalShell>
  );
}

export function VenueBroadcastModal({
  agencyId,
  onClose,
}: {
  agencyId: string;
  onClose: () => void;
}) {
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!confirmed || !message.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await postVenueNotification(agencyId, {
        audience: "all_security",
        message: message.trim(),
        priority: "emergency",
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Broadcast failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title="Emergency broadcast" onClose={onClose}>
      <p style={{ color: V.red, fontSize: 12, marginTop: 0 }}>
        This alerts all venue security immediately. Confirm before sending.
      </p>
      <textarea
        rows={4}
        placeholder="Broadcast message…"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        style={{ width: "100%", boxSizing: "border-box", padding: 8, fontSize: 12, background: "#141220", color: V.textPrimary, border: `1px solid ${V.red}`, borderRadius: 6 }}
      />
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: V.textPrimary, marginTop: 8 }}>
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        I confirm this emergency broadcast should be sent now.
      </label>
      {error ? <p style={{ color: V.red, fontSize: 11 }}>{error}</p> : null}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
        <button type="button" onClick={onClose}>Cancel</button>
        <button
          type="button"
          disabled={!confirmed || !message.trim() || busy}
          onClick={() => void submit()}
          style={{
            padding: "6px 12px",
            background: "#7f1d1d",
            color: "#fca5a5",
            border: `1px solid ${V.red}`,
            borderRadius: 6,
            fontWeight: 700,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          {busy ? "Sending…" : "Send broadcast"}
        </button>
      </div>
    </ModalShell>
  );
}
