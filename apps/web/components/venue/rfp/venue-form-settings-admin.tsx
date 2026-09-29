"use client";

import { useEffect, useState } from "react";
import type { VenueFormSchemaConfig } from "rapid-cortex-shared";
import { DEFAULT_VENUE_FORM_SCHEMA, venueFormSchemaPutBodySchema } from "rapid-cortex-shared";
import type { z } from "zod";

type VenueFormSchemaPutBody = z.infer<typeof venueFormSchemaPutBodySchema>;
import { fetchVenueFormSchema, putVenueFormSchema } from "@/lib/venue/venue-rfp-api";

export function VenueFormSettingsAdmin({
  venueCode,
  canMutate,
}: {
  venueCode: string;
  canMutate: boolean;
}) {
  const [schema, setSchema] = useState<VenueFormSchemaConfig>(DEFAULT_VENUE_FORM_SCHEMA);
  const [categoriesText, setCategoriesText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchVenueFormSchema(venueCode)
      .then((s) => {
        setSchema(s);
        setCategoriesText(s.categories.join(", "));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load schema"));
  }, [venueCode]);

  async function save() {
    if (!canMutate) return;
    setError(null);
    setMessage(null);
    const categories = categoriesText
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    const body: VenueFormSchemaPutBody = {
      version: schema.version + 1,
      categories: categories.length ? categories : schema.categories,
      severities: schema.severities,
      fields: schema.fields,
      approvalRequired: schema.approvalRequired,
    };
    try {
      const updated = await putVenueFormSchema(venueCode, body);
      setSchema(updated);
      setCategoriesText(updated.categories.join(", "));
      setMessage("Form schema saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }

  function toggleSeverity(level: "low" | "medium" | "high" | "critical") {
    setSchema((prev) => {
      const has = prev.severities.includes(level);
      const severities = has
        ? prev.severities.filter((s) => s !== level)
        : [...prev.severities, level];
      return { ...prev, severities: severities.length ? severities : prev.severities };
    });
  }

  return (
    <div
      className="space-y-4 rounded-lg border p-4"
      style={{ borderColor: "var(--rc-border)", background: "var(--rc-surface-alt)" }}
    >
      <h2 className="text-lg font-semibold" style={{ color: "var(--rc-amber)" }}>
        Incident form schema
      </h2>
      {error ? <p className="text-xs" style={{ color: "var(--rc-amber)" }}>{error}</p> : null}
      {message ? <p className="text-xs text-emerald-400">{message}</p> : null}

      <label className="block text-xs" style={{ color: "var(--rc-text-secondary)" }}>
        Categories (comma-separated)
        <input
          className="mt-1 w-full rounded border px-2 py-1 text-sm"
          style={{ borderColor: "var(--rc-border)", background: "var(--rc-surface-deep)" }}
          value={categoriesText}
          onChange={(e) => setCategoriesText(e.target.value)}
          disabled={!canMutate}
        />
      </label>

      <div>
        <p className="mb-2 text-xs font-semibold" style={{ color: "var(--rc-text-secondary)" }}>
          Severities
        </p>
        <div className="flex flex-wrap gap-2">
          {(["low", "medium", "high", "critical"] as const).map((level) => (
            <button
              key={level}
              type="button"
              disabled={!canMutate}
              onClick={() => toggleSeverity(level)}
              className="rounded-full border px-3 py-1 text-xs capitalize"
              style={{
                borderColor: "var(--rc-border)",
                background: schema.severities.includes(level)
                  ? "rgba(245,158,11,0.25)"
                  : "var(--rc-surface-deep)",
                color: schema.severities.includes(level) ? "var(--rc-amber)" : "var(--rc-text-muted)",
              }}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs" style={{ color: "var(--rc-text-secondary)" }}>
        <input
          type="checkbox"
          checked={schema.approvalRequired}
          disabled={!canMutate}
          onChange={(e) => setSchema((s) => ({ ...s, approvalRequired: e.target.checked }))}
        />
        Supervisor approval required before close
      </label>

      <div>
        <p className="mb-2 text-xs font-semibold" style={{ color: "var(--rc-text-secondary)" }}>
          Custom fields ({schema.fields.length})
        </p>
        <ul className="space-y-1 text-xs" style={{ color: "var(--rc-text-primary)" }}>
          {schema.fields.map((f) => (
            <li key={f.id}>
              {f.label} · {f.type}
              {f.required ? " · required" : ""}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[10px]" style={{ color: "var(--rc-text-muted)" }}>
          Field editor uses defaults from shared schema; extend via API for advanced layouts.
        </p>
      </div>

      {canMutate ? (
        <button
          type="button"
          onClick={() => void save()}
          className="rounded border px-4 py-2 text-xs font-semibold"
          style={{ borderColor: "var(--rc-border)", color: "var(--rc-amber)" }}
        >
          Save schema
        </button>
      ) : null}
    </div>
  );
}
