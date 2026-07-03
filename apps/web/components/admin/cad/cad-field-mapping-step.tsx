"use client";

import { useCallback, useState, type CSSProperties } from "react";
import {
  RC_DESTINATION_FIELDS,
  type CadVendorDefinition,
  type PriorityMapping,
  type RcDestinationFieldId,
} from "@/lib/cad/cad-vendor-definitions";

const V = {
  border: "#1e1a30",
  textPrimary: "#e4dff5",
  textSecondary: "#9b91bb",
  textMuted: "#5a4d7a",
  violet: "#7c3aed",
  green: "#10b981",
  amber: "#f59e0b",
  surfaceAlt: "#141220",
  bg: "#09080f",
} as const;

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "7px 10px",
  background: V.surfaceAlt,
  border: `1px solid ${V.border}`,
  borderRadius: 5,
  color: V.textPrimary,
  fontSize: 12,
  outline: "none",
};

const selectStyle: CSSProperties = { ...inputStyle, cursor: "pointer", appearance: "auto" };

export interface FieldMappingRow {
  id: string;
  sourceKey: string;
  targetId: RcDestinationFieldId | "";
}

export interface FieldMappingOutput {
  rows: FieldMappingRow[];
  priorityMapping: PriorityMapping;
}

interface Props {
  vendor: CadVendorDefinition;
  initial?: FieldMappingOutput;
  onChange: (output: FieldMappingOutput) => void;
}

let rowCounter = 0;
function newRowId(): string {
  rowCounter += 1;
  return `row-${rowCounter}`;
}

function defaultRows(vendor: CadVendorDefinition): FieldMappingRow[] {
  return vendor.defaultFieldMappings.map((m) => ({
    id: newRowId(),
    sourceKey: m.sourceKey,
    targetId: m.targetId,
  }));
}

const PRIORITY_RC_VALUES: Array<"P1" | "P2" | "P3" | "P4"> = ["P1", "P2", "P3", "P4"];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: V.textMuted,
        borderBottom: `1px solid ${V.border}`,
        paddingBottom: 5,
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

export function CadFieldMappingStep({ vendor, initial, onChange }: Props) {
  const [rows, setRows] = useState<FieldMappingRow[]>(initial?.rows ?? defaultRows(vendor));
  const [priorityMapping, setPriorityMapping] = useState<PriorityMapping>(
    initial?.priorityMapping ?? { ...vendor.defaultPriorityMapping },
  );
  const [showPreview, setShowPreview] = useState(false);
  const [newPriorityKey, setNewPriorityKey] = useState("");
  const [newPriorityVal, setNewPriorityVal] = useState<"P1" | "P2" | "P3" | "P4">("P2");

  const emit = useCallback(
    (nextRows: FieldMappingRow[], nextPriority: PriorityMapping) => {
      onChange({ rows: nextRows, priorityMapping: nextPriority });
    },
    [onChange],
  );

  function updateRow(id: string, field: "sourceKey" | "targetId", value: string) {
    const next = rows.map((r) => (r.id === id ? { ...r, [field]: value as RcDestinationFieldId } : r));
    setRows(next);
    emit(next, priorityMapping);
  }

  function addRow() {
    const next = [...rows, { id: newRowId(), sourceKey: "", targetId: "" as RcDestinationFieldId }];
    setRows(next);
    emit(next, priorityMapping);
  }

  function removeRow(id: string) {
    const next = rows.filter((r) => r.id !== id);
    setRows(next);
    emit(next, priorityMapping);
  }

  function applyVendorDefaults() {
    const next = defaultRows(vendor);
    const nextPriority = { ...vendor.defaultPriorityMapping };
    setRows(next);
    setPriorityMapping(nextPriority);
    emit(next, nextPriority);
  }

  function updatePriorityEntry(key: string, val: "P1" | "P2" | "P3" | "P4") {
    const next = { ...priorityMapping, [key]: val };
    setPriorityMapping(next);
    emit(rows, next);
  }

  function removePriorityEntry(key: string) {
    const next = { ...priorityMapping };
    delete next[key];
    setPriorityMapping(next);
    emit(rows, next);
  }

  function addPriorityEntry() {
    if (!newPriorityKey.trim()) return;
    const next = { ...priorityMapping, [newPriorityKey.trim()]: newPriorityVal };
    setPriorityMapping(next);
    setNewPriorityKey("");
    emit(rows, next);
  }

  const previewParsed = (() => {
    const result: Record<string, string> = {};
    for (const row of rows) {
      if (!row.sourceKey || !row.targetId) continue;
      const sourceField = vendor.sourceFields.find((f) => f.key === row.sourceKey);
      const example = sourceField?.example ?? "—";
      result[row.targetId] = row.targetId === "priority" ? (priorityMapping[example] ?? example) : example;
    }
    return result;
  })();

  const mappedCount = rows.filter((r) => r.sourceKey && r.targetId).length;
  const requiredFields = RC_DESTINATION_FIELDS.filter((f) => f.required);
  const missingRequired = requiredFields.filter((f) => !rows.some((r) => r.targetId === f.id && r.sourceKey));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 12, color: V.textSecondary }}>
            {mappedCount} field{mappedCount !== 1 ? "s" : ""} mapped
          </span>
          {missingRequired.length > 0 ? (
            <span style={{ fontSize: 11, color: V.amber, marginLeft: 8 }}>
              Missing required: {missingRequired.map((f) => f.label).join(", ")}
            </span>
          ) : mappedCount > 0 ? (
            <span style={{ fontSize: 11, color: V.green, marginLeft: 8 }}>All required fields mapped</span>
          ) : null}
        </div>
        <button type="button" onClick={applyVendorDefaults} style={toolbarBtnStyle}>
          Apply vendor defaults
        </button>
        <button
          type="button"
          onClick={() => setShowPreview((p) => !p)}
          style={{
            ...toolbarBtnStyle,
            background: showPreview ? "#1a1040" : V.surfaceAlt,
            border: `1px solid ${showPreview ? V.violet : V.border}`,
            color: showPreview ? V.textPrimary : V.textSecondary,
          }}
        >
          {showPreview ? "Hide preview" : "Show preview"}
        </button>
      </div>

      <SectionLabel>Field Mapping</SectionLabel>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 20px 1fr 28px",
          gap: 6,
          marginBottom: 4,
          padding: "0 2px",
        }}
      >
        <div style={colHeaderStyle}>CAD source field</div>
        <div />
        <div style={colHeaderStyle}>RC destination</div>
        <div />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
        {rows.map((row) => (
          <div
            key={row.id}
            style={{ display: "grid", gridTemplateColumns: "1fr 20px 1fr 28px", gap: 6, alignItems: "center" }}
          >
            <select value={row.sourceKey} onChange={(e) => updateRow(row.id, "sourceKey", e.target.value)} style={selectStyle}>
              <option value="">— source field —</option>
              {vendor.sourceFields.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.key} ({f.example})
                </option>
              ))}
              {row.sourceKey && !vendor.sourceFields.some((f) => f.key === row.sourceKey) ? (
                <option value={row.sourceKey}>{row.sourceKey} (custom)</option>
              ) : null}
            </select>
            <div style={{ textAlign: "center", color: V.textMuted, fontSize: 14 }}>→</div>
            <select value={row.targetId} onChange={(e) => updateRow(row.id, "targetId", e.target.value)} style={selectStyle}>
              <option value="">— RC field —</option>
              {RC_DESTINATION_FIELDS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                  {f.required ? " *" : ""}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => removeRow(row.id)} style={removeBtnStyle}>
              ×
            </button>
          </div>
        ))}
      </div>

      <button type="button" onClick={addRow} style={addRowBtnStyle}>
        + Add mapping row
      </button>

      <SectionLabel>Priority Mapping</SectionLabel>
      <div
        style={{
          fontSize: 11,
          color: V.textSecondary,
          marginBottom: 10,
          background: "#0c0a18",
          border: `1px solid ${V.border}`,
          borderLeft: `3px solid ${V.amber}`,
          borderRadius: 5,
          padding: "8px 10px",
        }}
      >
        Map vendor priority codes to Rapid Cortex P1–P4.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
        {Object.entries(priorityMapping).map(([key, val]) => (
          <div
            key={key}
            style={{ display: "grid", gridTemplateColumns: "1fr 20px 1fr 28px", gap: 6, alignItems: "center" }}
          >
            <div style={{ ...inputStyle, fontFamily: "monospace" }}>{key}</div>
            <div style={{ textAlign: "center", color: V.textMuted, fontSize: 14 }}>→</div>
            <select
              value={val}
              onChange={(e) => updatePriorityEntry(key, e.target.value as "P1" | "P2" | "P3" | "P4")}
              style={selectStyle}
            >
              {PRIORITY_RC_VALUES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => removePriorityEntry(key)} style={removeBtnStyle}>
              ×
            </button>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 20px 1fr 28px",
          gap: 6,
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <input
          type="text"
          placeholder="Vendor code (e.g. IMMEDIATE)"
          value={newPriorityKey}
          onChange={(e) => setNewPriorityKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addPriorityEntry();
          }}
          style={inputStyle}
        />
        <div style={{ textAlign: "center", color: V.textMuted, fontSize: 14 }}>→</div>
        <select
          value={newPriorityVal}
          onChange={(e) => setNewPriorityVal(e.target.value as "P1" | "P2" | "P3" | "P4")}
          style={selectStyle}
        >
          {PRIORITY_RC_VALUES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={addPriorityEntry}
          disabled={!newPriorityKey.trim()}
          style={{
            ...removeBtnStyle,
            background: newPriorityKey.trim() ? V.violet : V.surfaceAlt,
            color: "#fff",
            border: "none",
          }}
        >
          +
        </button>
      </div>

      {showPreview ? (
        <div>
          <SectionLabel>Mapping Preview — Sample Parsed Incident</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <PreviewPane title="VENDOR RAW PAYLOAD" vendor={vendor} />
            <div>
              <div style={colHeaderStyle}>RC PARSED INCIDENT</div>
              <pre style={codeBlockStyle}>
                {JSON.stringify(previewParsed, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PreviewPane({ title, vendor }: { title: string; vendor: CadVendorDefinition }) {
  const sample: Record<string, string> = {};
  for (const f of vendor.sourceFields.slice(0, 8)) sample[f.key] = f.example;
  return (
    <div>
      <div style={colHeaderStyle}>{title}</div>
      <pre style={codeBlockStyle}>{JSON.stringify(sample, null, 2)}</pre>
    </div>
  );
}

const colHeaderStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: V.textMuted,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  marginBottom: 5,
};

const toolbarBtnStyle: CSSProperties = {
  padding: "6px 10px",
  background: V.surfaceAlt,
  border: `1px solid ${V.border}`,
  borderRadius: 5,
  color: V.textSecondary,
  fontSize: 11,
  cursor: "pointer",
};

const removeBtnStyle: CSSProperties = {
  width: 24,
  height: 24,
  background: "none",
  border: `1px solid ${V.border}`,
  borderRadius: 4,
  color: V.textMuted,
  cursor: "pointer",
  fontSize: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const addRowBtnStyle: CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  background: "transparent",
  border: `1px dashed ${V.border}`,
  borderRadius: 5,
  color: V.textMuted,
  fontSize: 12,
  cursor: "pointer",
  marginBottom: 20,
};

const codeBlockStyle: CSSProperties = {
  background: "#080610",
  border: `1px solid ${V.border}`,
  borderRadius: 5,
  padding: "10px 12px",
  fontFamily: "monospace",
  fontSize: 11,
  color: V.textSecondary,
  overflowX: "auto",
  margin: 0,
};
