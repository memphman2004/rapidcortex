"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import type { VenueCaseActionBody } from "rapid-cortex-shared";
import {
  fetchVenueCase,
  postVenueCaseAction,
  type VenueCaseIncident,
} from "@/lib/venue/venue-rfp-api";
import { VenueRfpPanelShell } from "./venue-rfp-panel-shell";

export function VenueCaseWorkflowPanel({
  venueCode,
  incidentId,
  canMutate,
}: {
  venueCode: string;
  incidentId: string;
  canMutate: boolean;
}) {
  const [incident, setIncident] = useState<VenueCaseIncident | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState("");
  const [assigneeLabel, setAssigneeLabel] = useState("");
  const [linkedId, setLinkedId] = useState("");
  const [note, setNote] = useState("");
  const [disposition, setDisposition] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const row = await fetchVenueCase(venueCode, incidentId);
      setIncident(row);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load case");
    } finally {
      setLoading(false);
    }
  }, [incidentId, venueCode]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function runAction(body: VenueCaseActionBody) {
    if (!canMutate) return;
    setError(null);
    try {
      const updated = await postVenueCaseAction(venueCode, incidentId, body);
      setIncident(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  }

  if (loading) {
    return (
      <VenueRfpPanelShell title="Case workflow">
        <p style={{ fontSize: 12, color: "var(--rc-text-muted)" }}>Loading case…</p>
      </VenueRfpPanelShell>
    );
  }

  if (!incident) {
    return (
      <VenueRfpPanelShell title="Case workflow">
        <p style={{ fontSize: 12, color: "var(--rc-amber)" }}>{error ?? "Case not found"}</p>
      </VenueRfpPanelShell>
    );
  }

  return (
    <VenueRfpPanelShell title="Case workflow">
      {error ? <p style={{ fontSize: 11, color: "var(--rc-amber)", marginBottom: 8 }}>{error}</p> : null}
      <div style={{ display: "grid", gap: 8, fontSize: 12, marginBottom: 12 }}>
        <div>
          Status: <strong style={{ color: "var(--rc-amber)" }}>{incident.status}</strong>
          {incident.approvalStatus ? ` · Approval: ${incident.approvalStatus}` : null}
        </div>
        <div>
          Assigned: {incident.assignedLabel || incident.assignedTo || "—"}
        </div>
        {incident.linkedIncidentIds?.length ? (
          <div>Linked: {incident.linkedIncidentIds.join(", ")}</div>
        ) : null}
        {incident.disposition ? (
          <div>
            Disposition: {incident.disposition}
          </div>
        ) : null}
      </div>

      {canMutate ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <input
              placeholder="Assignee ID"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              style={inputStyle}
            />
            <input
              placeholder="Assignee label"
              value={assigneeLabel}
              onChange={(e) => setAssigneeLabel(e.target.value)}
              style={inputStyle}
            />
            <button
              type="button"
              style={btnStyle}
              onClick={() =>
                void runAction({
                  action: "assign",
                  assigneeId: assigneeId.trim(),
                  assigneeLabel: assigneeLabel.trim() || assigneeId.trim(),
                })
              }
            >
              Assign
            </button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" style={btnStyle} onClick={() => void runAction({ action: "investigate" })}>
              Start response
            </button>
            <button type="button" style={btnStyle} onClick={() => void runAction({ action: "escalate", note })}>
              Escalate
            </button>
            <button type="button" style={btnStyle} onClick={() => void runAction({ action: "submit_for_approval" })}>
              Submit for approval
            </button>
            <button type="button" style={btnStyle} onClick={() => void runAction({ action: "approve", note })}>
              Approve
            </button>
            <button
              type="button"
              style={btnStyle}
              onClick={() =>
                void runAction({ action: "reject", note } as unknown as VenueCaseActionBody)
              }
            >
              Reject
            </button>
            <button type="button" style={btnStyle} onClick={() => void runAction({ action: "reopen", note })}>
              Reopen
            </button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <input
              placeholder="Link incident ID"
              value={linkedId}
              onChange={(e) => setLinkedId(e.target.value)}
              style={inputStyle}
            />
            <button
              type="button"
              style={btnStyle}
              onClick={() =>
                void runAction({ action: "link", linkedIncidentId: linkedId.trim(), note })
              }
            >
              Link incident
            </button>
          </div>
          <textarea
            placeholder="Note (approval / escalation / close)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            style={{ ...inputStyle, width: "100%" }}
          />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <input
              placeholder="Disposition on close"
              value={disposition}
              onChange={(e) => setDisposition(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              type="button"
              style={btnStyle}
              onClick={() => void runAction({ action: "close", note: disposition || note })}
            >
              Close case
            </button>
          </div>
        </div>
      ) : null}

      <h4 style={{ fontSize: 11, margin: "0 0 6px", color: "var(--rc-text-secondary)" }}>Status timeline</h4>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11 }}>
        {(incident.statusHistory ?? []).slice(-12).map((evt, i) => (
          <li key={`${evt.at}-${i}`}>
            {evt.at}: {evt.from} → {evt.to}
          </li>
        ))}
        {(incident.statusHistory ?? []).length === 0 ? (
          <li style={{ color: "var(--rc-text-muted)" }}>No status history recorded.</li>
        ) : null}
      </ul>
    </VenueRfpPanelShell>
  );
}

const btnStyle: CSSProperties = {
  fontSize: 11,
  padding: "4px 10px",
  borderRadius: 6,
  border: "1px solid var(--rc-border)",
  background: "var(--rc-surface)",
  color: "var(--rc-text-primary)",
  cursor: "pointer",
};

const inputStyle: CSSProperties = {
  fontSize: 11,
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid var(--rc-border)",
  background: "var(--rc-surface-deep)",
  color: "var(--rc-text-primary)",
};
