"use client";

/**
 * Dispatcher workspace "Create Incident" slide-over (Phase 1).
 * Right-edge panel; Alt+N shortcut; POST /api/incidents via BFF (agencyId from JWT).
 */

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { postCreateIncident } from "@/lib/api";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  INCIDENT_TYPES,
  PRIORITY_META,
  getIncidentType,
  isSupervisorCreateRole,
  type IncidentPriority,
  type IncidentTypeDefinition,
} from "@/lib/dispatcher/incident-protocols";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";

const V = {
  bg: "#09080f",
  surface: "#0f0d1a",
  surfaceAlt: "#141220",
  border: "#1e1a30",
  textPrimary: "#e4dff5",
  textSecondary: "#9b91bb",
  textMuted: "#5a4d7a",
  violet: "#7c3aed",
  violetHover: "#6d28d9",
  red: "#ef4444",
  amber: "#f59e0b",
  successBg: "#052e16",
  successBorder: "#166534",
  successText: "#86efac",
} as const;

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 12px",
  background: V.surfaceAlt,
  border: `1px solid ${V.border}`,
  borderRadius: 6,
  color: V.textPrimary,
  fontSize: 13,
  lineHeight: 1.4,
  outline: "none",
  transition: "border-color 0.15s",
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: V.textMuted,
  marginBottom: 6,
};

export interface CreateIncidentResult {
  incidentId: string;
  cadNatureCode: string;
  priority: IncidentPriority;
  location: string;
  callerName: string;
  callerPhone: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (result: CreateIncidentResult) => void;
  userRole?: string;
  mapboxToken?: string;
}

function buildIncidentTitle(typeLabel: string, locationLine: string): string {
  const loc = locationLine.trim();
  const base = loc ? `${typeLabel} — ${loc}` : typeLabel;
  return base.length >= 3 ? base.slice(0, 240) : `${typeLabel} incident`;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: V.textMuted,
        borderBottom: `1px solid ${V.border}`,
        paddingBottom: 6,
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function PriorityButton({
  priority,
  selected,
  onClick,
}: {
  priority: IncidentPriority;
  selected: boolean;
  onClick: () => void;
}) {
  const meta = PRIORITY_META[priority];
  return (
    <button
      type="button"
      onClick={onClick}
      title={meta.description}
      style={{
        flex: 1,
        padding: "8px 4px",
        background: selected ? meta.bg : V.surfaceAlt,
        border: `1px solid ${selected ? meta.border : V.border}`,
        borderRadius: 6,
        color: selected ? meta.color : V.textSecondary,
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        transition: "all 0.15s",
        boxShadow: selected ? `0 0 0 1px ${meta.border}` : "none",
      }}
    >
      {meta.label}
    </button>
  );
}

function IncidentTypeCard({
  type,
  selected,
  onClick,
}: {
  type: IncidentTypeDefinition;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        padding: "10px 6px",
        background: selected ? "#1a1040" : V.surfaceAlt,
        border: `1px solid ${selected ? V.violet : V.border}`,
        borderRadius: 8,
        cursor: "pointer",
        transition: "all 0.15s",
        boxShadow: selected ? `0 0 0 1px ${V.violet}` : "none",
        minHeight: 72,
      }}
    >
      <span style={{ fontSize: 20, lineHeight: 1 }}>{type.icon}</span>
      <span
        style={{
          fontSize: 10,
          fontWeight: selected ? 700 : 500,
          color: selected ? V.textPrimary : V.textSecondary,
          textAlign: "center",
          lineHeight: 1.3,
        }}
      >
        {type.label}
      </span>
    </button>
  );
}

function ProtocolHints({ typeId }: { typeId: string }) {
  const type = getIncidentType(typeId);
  if (!type) return null;

  return (
    <div
      style={{
        background: "#0c0a18",
        border: `1px solid ${V.border}`,
        borderLeft: `3px solid ${V.violet}`,
        borderRadius: 6,
        padding: "10px 12px",
        marginTop: 8,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: V.textMuted, marginBottom: 6 }}>
        PROTOCOL HINTS — {type.label.toUpperCase()}
      </div>
      <ul style={{ margin: 0, paddingLeft: 16, listStyle: "none" }}>
        {type.protocolHints.map((hint) => (
          <li
            key={hint}
            style={{
              fontSize: 12,
              color: V.textSecondary,
              marginBottom: 4,
              display: "flex",
              alignItems: "flex-start",
              gap: 6,
            }}
          >
            <span style={{ color: V.violet, flexShrink: 0, marginTop: 1 }}>›</span>
            {hint}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CreateIncidentSlideOver({
  open,
  onClose,
  onCreated,
  userRole,
  mapboxToken,
}: Props) {
  const [incidentTypeId, setIncidentTypeId] = useState("");
  const [priority, setPriority] = useState<IncidentPriority>("P2");
  const [location, setLocation] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [callerName, setCallerName] = useState("");
  const [callerPhoneE164, setCallerPhoneE164] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [assignTo, setAssignTo] = useState("");

  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CreateIncidentResult | null>(null);

  const handleTypeSelect = useCallback((id: string) => {
    setIncidentTypeId(id);
    const def = getIncidentType(id);
    if (def) setPriority(def.defaultPriority);
    setSubmitError(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    setIncidentTypeId("");
    setPriority("P2");
    setLocation("");
    setLat(null);
    setLng(null);
    setCallerName("");
    setCallerPhoneE164(null);
    setDescription("");
    setAssignTo("");
    setSubmitError(null);
    setGeocodeError(null);
    setSuccess(null);
  }, [open]);

  const handleEscape = useCallback(() => {
    if (!submitting) onClose();
  }, [onClose, submitting]);

  useKeyboardShortcut({ key: "Escape", enabled: open, preventDefault: false }, handleEscape);

  async function geocodeLocation(): Promise<void> {
    if (!location.trim() || !mapboxToken) return;
    setGeocoding(true);
    setGeocodeError(null);

    try {
      const query = encodeURIComponent(location.trim());
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${mapboxToken}&types=address&limit=1`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Geocode request failed");
      const data = (await res.json()) as {
        features?: { center?: [number, number]; place_name?: string }[];
      };
      const feature = data.features?.[0];
      if (!feature?.center) {
        setGeocodeError("Address not found — verify and retry");
        return;
      }
      setLng(feature.center[0]);
      setLat(feature.center[1]);
      if (feature.place_name) setLocation(feature.place_name);
    } catch {
      setGeocodeError("Geocode unavailable — coordinates not set");
    } finally {
      setGeocoding(false);
    }
  }

  function validate(): string | null {
    if (!incidentTypeId) return "Select an incident type";
    if (!location.trim()) return "Location is required";
    return null;
  }

  async function handleSubmit(): Promise<void> {
    const err = validate();
    if (err) {
      setSubmitError(err);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const type = getIncidentType(incidentTypeId)!;
    const locationLine = location.trim();
    const phoneNorm = callerPhoneE164 ?? "";

    try {
      const incident = await postCreateIncident({
        title: buildIncidentTitle(type.label, locationLine),
        callerAddressLine: locationLine,
        cadNatureCode: type.cadNatureCode,
        cadPriority: priority,
        cadLocation: locationLine,
        cadCoordinates: lat != null && lng != null ? { lat, lng } : undefined,
        cadCallerName: callerName.trim() || undefined,
        callerCallback: phoneNorm || undefined,
        summary: description.trim() || undefined,
        assignedTo: assignTo.trim() || undefined,
      });

      const result: CreateIncidentResult = {
        incidentId: incident.incidentId,
        cadNatureCode: type.cadNatureCode,
        priority,
        location: locationLine,
        callerName: callerName.trim(),
        callerPhone: phoneNorm,
      };

      setSuccess(result);
      onCreated?.(result);

      window.setTimeout(() => {
        onClose();
      }, 1400);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to create incident");
    } finally {
      setSubmitting(false);
    }
  }

  const canGeocode = !!mapboxToken?.trim() && !!location.trim();
  const selectedType = incidentTypeId ? getIncidentType(incidentTypeId) : null;
  const isSupervisor = isSupervisorCreateRole(userRole);
  const priorityBorder = selectedType ? PRIORITY_META[priority].border : V.border;

  return (
    <>
      {open ? (
        <div
          role="presentation"
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 200,
            backdropFilter: "blur(1px)",
          }}
        />
      ) : null}

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create new incident"
        aria-hidden={!open}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 480,
          maxWidth: "100vw",
          zIndex: 201,
          background: V.surface,
          borderLeft: `3px solid ${open && selectedType ? priorityBorder : V.border}`,
          display: "flex",
          flexDirection: "column",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: open ? "-8px 0 40px rgba(0,0,0,0.6)" : "none",
          overflow: "hidden",
          pointerEvents: open ? "auto" : "none",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: `1px solid ${V.border}`,
            flexShrink: 0,
            background: V.bg,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: selectedType ? PRIORITY_META[priority].color : V.textMuted,
                boxShadow: selectedType ? `0 0 6px ${PRIORITY_META[priority].color}` : "none",
                transition: "all 0.2s",
              }}
            />
            <span style={{ color: V.textPrimary, fontSize: 14, fontWeight: 700, letterSpacing: "0.02em" }}>
              New Incident
            </span>
            {selectedType ? (
              <span
                style={{
                  fontSize: 11,
                  color: PRIORITY_META[priority].color,
                  background: PRIORITY_META[priority].bg,
                  border: `1px solid ${PRIORITY_META[priority].border}`,
                  borderRadius: 4,
                  padding: "2px 7px",
                  fontWeight: 700,
                }}
              >
                {priority}
              </span>
            ) : null}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 10, color: V.textMuted, letterSpacing: "0.04em" }}>ALT+N</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close panel"
              style={{
                background: "none",
                border: "none",
                color: V.textMuted,
                cursor: "pointer",
                fontSize: 18,
                lineHeight: 1,
                padding: "2px 4px",
                borderRadius: 4,
              }}
            >
              ×
            </button>
          </div>
        </div>

        {success ? (
          <div
            style={{
              margin: 16,
              padding: "12px 14px",
              background: V.successBg,
              border: `1px solid ${V.successBorder}`,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 18 }}>✓</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: V.successText }}>Incident created</div>
              <div style={{ fontSize: 11, color: V.successText, opacity: 0.75, marginTop: 2 }}>
                ID {success.incidentId} · {success.location}
              </div>
            </div>
          </div>
        ) : null}

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
          <SectionLabel>Incident Type</SectionLabel>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 8,
              marginBottom: 4,
            }}
          >
            {INCIDENT_TYPES.map((type) => (
              <IncidentTypeCard
                key={type.id}
                type={type}
                selected={incidentTypeId === type.id}
                onClick={() => handleTypeSelect(type.id)}
              />
            ))}
          </div>

          {incidentTypeId ? <ProtocolHints typeId={incidentTypeId} /> : null}

          <div style={{ marginTop: 18 }}>
            <SectionLabel>Priority</SectionLabel>
            <div style={{ display: "flex", gap: 8 }}>
              {(["P1", "P2", "P3", "P4"] as IncidentPriority[]).map((p) => (
                <PriorityButton
                  key={p}
                  priority={p}
                  selected={priority === p}
                  onClick={() => setPriority(p)}
                />
              ))}
            </div>
            <div style={{ fontSize: 11, color: V.textMuted, marginTop: 5 }}>
              {PRIORITY_META[priority].description}
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <SectionLabel>Location</SectionLabel>
            <FieldGroup label="Address / Location *">
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  placeholder="123 Main St, Building A, Floor 3…"
                  value={location}
                  onChange={(e) => {
                    setLocation(e.target.value);
                    if (lat !== null || lng !== null) {
                      setLat(null);
                      setLng(null);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canGeocode) void geocodeLocation();
                  }}
                  style={inputStyle}
                  aria-required="true"
                />
                {mapboxToken?.trim() ? (
                  <button
                    type="button"
                    disabled={!canGeocode || geocoding}
                    onClick={() => void geocodeLocation()}
                    title="Geocode address — sets GPS coordinates"
                    style={{
                      flexShrink: 0,
                      padding: "9px 12px",
                      background: lat !== null ? "#052e16" : V.surfaceAlt,
                      border: `1px solid ${lat !== null ? "#166534" : V.border}`,
                      borderRadius: 6,
                      color: lat !== null ? "#86efac" : V.textSecondary,
                      fontSize: 13,
                      cursor: canGeocode ? "pointer" : "not-allowed",
                      opacity: canGeocode ? 1 : 0.5,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {geocoding ? "…" : lat !== null ? "✓ GPS" : "📍 Geocode"}
                  </button>
                ) : null}
              </div>
              {geocodeError ? (
                <div style={{ fontSize: 11, color: V.amber, marginTop: 4 }}>{geocodeError}</div>
              ) : null}
              {lat !== null && lng !== null ? (
                <div style={{ fontSize: 10, color: V.textMuted, marginTop: 4 }}>
                  {lat.toFixed(5)}, {lng.toFixed(5)}
                </div>
              ) : null}
            </FieldGroup>
          </div>

          <div style={{ marginTop: 18 }}>
            <SectionLabel>Caller Information</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <FieldGroup label="Caller Name">
                <input
                  type="text"
                  placeholder="John Doe"
                  value={callerName}
                  onChange={(e) => setCallerName(e.target.value)}
                  style={inputStyle}
                />
              </FieldGroup>
              <PhoneInput
                label="Callback Number"
                onChange={setCallerPhoneE164}
                placeholder="(555) 555-5555"
              />
            </div>

            <FieldGroup label="Nature of Call / Notes">
              <textarea
                rows={3}
                placeholder="Describe the incident — suspect description, injuries, weapons, hazards…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{
                  ...inputStyle,
                  resize: "vertical",
                  minHeight: 72,
                  fontFamily: "inherit",
                }}
              />
            </FieldGroup>
          </div>

          {isSupervisor ? (
            <div style={{ marginTop: 18 }}>
              <SectionLabel>Supervisor Override</SectionLabel>
              <FieldGroup label="Assign To (Unit ID or Dispatcher)">
                <input
                  type="text"
                  placeholder="Unit 4 / John Smith…"
                  value={assignTo}
                  onChange={(e) => setAssignTo(e.target.value)}
                  style={inputStyle}
                />
              </FieldGroup>
              {selectedType?.supervisorAlert ? (
                <div
                  style={{
                    fontSize: 11,
                    color: V.amber,
                    background: "#1c0f00",
                    border: "1px solid #92400e",
                    borderRadius: 6,
                    padding: "8px 10px",
                    display: "flex",
                    gap: 6,
                    alignItems: "flex-start",
                  }}
                >
                  <span>⚠</span>
                  <span>This incident type triggers automatic supervisor notification on creation.</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {submitError ? (
            <div
              style={{
                marginTop: 14,
                padding: "10px 12px",
                background: "#1f0808",
                border: `1px solid ${V.red}`,
                borderRadius: 6,
                fontSize: 12,
                color: "#fca5a5",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>⚠</span>
              {submitError}
            </div>
          ) : null}

          <div style={{ height: 80 }} />
        </div>

        <div
          style={{
            position: "sticky",
            bottom: 0,
            borderTop: `1px solid ${V.border}`,
            background: V.bg,
            padding: "12px 18px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 10, color: V.textMuted, flex: 1 }}>* Required</span>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: "9px 16px",
              background: "transparent",
              border: `1px solid ${V.border}`,
              borderRadius: 6,
              color: V.textSecondary,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={submitting || !!success}
            onClick={() => void handleSubmit()}
            style={{
              padding: "9px 20px",
              background: submitting ? V.surfaceAlt : V.violet,
              border: `1px solid ${submitting ? V.border : V.violetHover}`,
              borderRadius: 6,
              color: submitting ? V.textMuted : "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
              transition: "background 0.15s",
              minWidth: 130,
            }}
          >
            {submitting ? "Creating…" : "Create Incident"}
          </button>
        </div>
      </div>
    </>
  );
}

export function CreateIncidentButton({
  userRole,
  mapboxToken,
  onCreated,
  className,
  disabled,
}: {
  userRole?: string;
  mapboxToken?: string;
  onCreated?: (result: CreateIncidentResult) => void;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const openPanel = useCallback(() => {
    if (!disabled) setOpen(true);
  }, [disabled]);

  useKeyboardShortcut({ key: "n", modifiers: ["alt"], enabled: !disabled }, openPanel);

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        disabled={disabled}
        className={className}
        title="Create new incident (Alt+N)"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "8px 14px",
          background: "#1a0f2e",
          border: `1px solid ${V.violet}`,
          borderRadius: 6,
          color: V.textPrimary,
          fontSize: 13,
          fontWeight: 600,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          transition: "background 0.15s",
        }}
      >
        <span style={{ fontSize: 15, lineHeight: 1 }}>+</span>
        New Incident
        <span
          style={{
            fontSize: 10,
            color: V.textMuted,
            background: V.surfaceAlt,
            border: `1px solid ${V.border}`,
            borderRadius: 3,
            padding: "1px 5px",
            fontFamily: "monospace",
          }}
        >
          Alt+N
        </span>
      </button>

      <CreateIncidentSlideOver
        open={open}
        onClose={() => setOpen(false)}
        onCreated={onCreated}
        userRole={userRole}
        mapboxToken={mapboxToken}
      />
    </>
  );
}
