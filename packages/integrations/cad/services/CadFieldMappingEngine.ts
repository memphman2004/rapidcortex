import type { CadAdapterFieldError } from "../adapter/CadAdapter.js";
import type {
  CadFieldMapping,
  CadWriteBackPayload,
  UnifiedCadIncident,
} from "rapid-cortex-shared";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/** Resolve dotted paths and simple JSONPath `foo[*].bar` (first match). */
export function resolveVendorPath(raw: Record<string, unknown>, path: string): unknown {
  const trimmed = path.trim();
  if (!trimmed) return undefined;
  const parts = trimmed.replace(/^\$\.?/, "").split(".");
  let current: unknown = raw;
  for (const part of parts) {
    const arrayMatch = part.match(/^([A-Za-z0-9_]+)\[(\*|\d+)\]$/);
    if (arrayMatch) {
      const rec = asRecord(current);
      const arr = rec?.[arrayMatch[1]!];
      if (!Array.isArray(arr)) return undefined;
      if (arrayMatch[2] === "*") {
        current = arr[0];
      } else {
        current = arr[Number(arrayMatch[2])];
      }
      continue;
    }
    const rec = asRecord(current);
    if (!rec) return undefined;
    current = rec[part];
  }
  return current;
}

function applyTransform(
  value: unknown,
  transform: CadFieldMapping["transform"],
): unknown {
  if (!transform) return value;
  switch (transform.type) {
    case "uppercase":
      return String(value ?? "").toUpperCase();
    case "lowercase":
      return String(value ?? "").toLowerCase();
    case "trim":
      return String(value ?? "").trim();
    case "static_value":
      return transform.value;
    case "code_lookup": {
      const key = String(value ?? "");
      return (
        transform.table[key] ??
        transform.table[key.toUpperCase()] ??
        transform.table[key.toLowerCase()] ??
        value
      );
    }
    case "regex_extract": {
      const match = String(value ?? "").match(new RegExp(transform.pattern));
      return match?.[transform.group] ?? undefined;
    }
    case "date_iso": {
      const raw = String(value ?? "").trim();
      if (!raw) return undefined;
      const parsed = Date.parse(raw);
      if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
      // sourceFormat is documented for agency config; fall back to original if unparsable.
      return raw;
    }
    default:
      return value;
  }
}

function assignRcField(target: Record<string, unknown>, rcField: string, value: unknown): void {
  const parts = rcField.split(".");
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i]!;
    const next = cursor[key];
    if (!asRecord(next)) cursor[key] = {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]!] = value;
}

export class CadFieldMappingEngine {
  static applyInbound(
    raw: Record<string, unknown>,
    mappings: CadFieldMapping[],
  ): { result: Partial<UnifiedCadIncident>; errors: CadAdapterFieldError[] } {
    const result: Record<string, unknown> = {};
    const errors: CadAdapterFieldError[] = [];
    for (const mapping of mappings) {
      if (mapping.direction === "outbound") continue;
      try {
        const resolved =
          mapping.transform?.type === "static_value"
            ? mapping.transform.value
            : resolveVendorPath(raw, mapping.vendorField);
        if (resolved == null || resolved === "") {
          if (mapping.required) {
            errors.push({
              field: mapping.vendorField,
              message: `Required vendor field missing: ${mapping.vendorField}`,
            });
          }
          continue;
        }
        const transformed = applyTransform(resolved, mapping.transform);
        if (transformed == null || transformed === "") {
          if (mapping.required) {
            errors.push({
              field: mapping.vendorField,
              message: `Required field empty after transform: ${mapping.vendorField}`,
              rawValue: resolved,
            });
          }
          continue;
        }
        assignRcField(result, mapping.rcField, transformed);
      } catch (err) {
        errors.push({
          field: mapping.vendorField,
          message: err instanceof Error ? err.message : "Mapping failed",
          rawValue: raw[mapping.vendorField],
        });
      }
    }
    return { result: result as Partial<UnifiedCadIncident>, errors };
  }

  static applyOutbound(
    writeBack: CadWriteBackPayload,
    mappings: CadFieldMapping[],
  ): { result: Record<string, unknown>; errors: CadAdapterFieldError[] } {
    const result: Record<string, unknown> = {};
    const errors: CadAdapterFieldError[] = [];
    const source: Record<string, unknown> = {
      ...writeBack.fields,
      action: writeBack.action,
      narrative: writeBack.narrative,
    };
    for (const mapping of mappings) {
      if (mapping.direction === "inbound") continue;
      const resolved = resolveVendorPath(source, mapping.rcField) ?? source[mapping.rcField];
      if (resolved == null || resolved === "") {
        if (mapping.required) {
          errors.push({
            field: mapping.rcField,
            message: `Required outbound RC field missing: ${mapping.rcField}`,
          });
        }
        continue;
      }
      result[mapping.vendorField] = applyTransform(resolved, mapping.transform);
    }
    return { result, errors };
  }
}
