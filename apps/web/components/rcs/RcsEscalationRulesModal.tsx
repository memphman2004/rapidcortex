"use client";

import { useEffect, useState } from "react";
import { Settings2, X } from "lucide-react";
import { RCS_SURFACE } from "@/lib/rcs/rcs-colors";
import {
  rcsGetEscalationRules,
  rcsPutEscalationRules,
  type RcsEscalationRules,
} from "@/lib/rcs/rcs-api";

export type RcsEscalationRulesModalProps = {
  open: boolean;
  onClose: () => void;
};

type FormState = Omit<RcsEscalationRules, "agencyId" | "updatedAt" | "updatedByUserId">;

const DEFAULTS: FormState = {
  dispatchedWithoutArrivalSeconds: 480,
  level1UnackedSeconds: 300,
  level2UnackedSeconds: 300,
  audioSilenceAlertSeconds: 45,
  supervisorPushOnEscalation: true,
};

export function RcsEscalationRulesModal({ open, onClose }: RcsEscalationRulesModalProps) {
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSaved(false);
    void rcsGetEscalationRules()
      .then((rules) => {
        if (cancelled) return;
        setForm({
          dispatchedWithoutArrivalSeconds: rules.dispatchedWithoutArrivalSeconds,
          level1UnackedSeconds: rules.level1UnackedSeconds,
          level2UnackedSeconds: rules.level2UnackedSeconds,
          audioSilenceAlertSeconds: rules.audioSilenceAlertSeconds,
          supervisorPushOnEscalation: rules.supervisorPushOnEscalation,
        });
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load rules");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await rcsPutEscalationRules(form);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(2, 6, 23, 0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(480px, 100%)",
          borderRadius: 12,
          border: `1px solid ${RCS_SURFACE.border}`,
          background: RCS_SURFACE.cardBg,
          padding: 18,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Settings2 size={16} color="#c4b5fd" />
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: RCS_SURFACE.heading }}>
            Escalation Rules
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ marginLeft: "auto", background: "none", border: "none", color: RCS_SURFACE.subtleText, cursor: "pointer" }}
          >
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <p style={{ fontSize: 12, color: RCS_SURFACE.subtleText }}>Loading…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <NumberField
              label="Dispatched without arrival (sec)"
              value={form.dispatchedWithoutArrivalSeconds}
              onChange={(v) => setForm((f) => ({ ...f, dispatchedWithoutArrivalSeconds: v }))}
            />
            <NumberField
              label="LEVEL_1 unacked (sec)"
              value={form.level1UnackedSeconds}
              onChange={(v) => setForm((f) => ({ ...f, level1UnackedSeconds: v }))}
            />
            <NumberField
              label="LEVEL_2 unacked (sec)"
              value={form.level2UnackedSeconds}
              onChange={(v) => setForm((f) => ({ ...f, level2UnackedSeconds: v }))}
            />
            <NumberField
              label="Audio silence alert (sec)"
              value={form.audioSilenceAlertSeconds}
              onChange={(v) => setForm((f) => ({ ...f, audioSilenceAlertSeconds: v }))}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: RCS_SURFACE.bodyText }}>
              <input
                type="checkbox"
                checked={form.supervisorPushOnEscalation}
                onChange={(e) =>
                  setForm((f) => ({ ...f, supervisorPushOnEscalation: e.target.checked }))
                }
              />
              Push WebSocket to supervisors on escalation
            </label>
            {error ? <p style={{ margin: 0, fontSize: 12, color: "#fca5a5" }}>{error}</p> : null}
            {saved ? <p style={{ margin: 0, fontSize: 12, color: "#86efac" }}>Saved.</p> : null}
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              style={{
                borderRadius: 6,
                border: "1px solid rgba(167, 139, 250, 0.45)",
                background: "rgba(124, 58, 237, 0.25)",
                color: "#e9d5ff",
                fontSize: 12,
                fontWeight: 600,
                padding: "8px 12px",
                cursor: saving ? "wait" : "pointer",
              }}
            >
              {saving ? "Saving…" : "Save rules"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: RCS_SURFACE.subtleText }}>
      {label}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        style={{
          borderRadius: 6,
          border: `1px solid ${RCS_SURFACE.border}`,
          background: "#0f172a",
          color: RCS_SURFACE.heading,
          padding: "7px 10px",
          fontSize: 13,
        }}
      />
    </label>
  );
}
