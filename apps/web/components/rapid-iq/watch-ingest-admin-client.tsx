"use client";

import { useState } from "react";

const SAMPLE = `{
  "source": "chatgpt_watch",
  "watch": "psap_intelligence",
  "external_key": "FL|Ocala|RealTimeCrimeCenter|FY2027",
  "primary_vertical": "rtcc",
  "verticals": ["rtcc", "psap"],
  "agency": {
    "name": "City of Ocala",
    "department": "Police Department",
    "city": "Ocala",
    "state": "FL",
    "country": "US"
  },
  "signal": {
    "type": "funded",
    "category": "RTCC / intelligence fusion",
    "strength": "confirmed",
    "buying_stage": "planning",
    "event_date": "2026-05-04",
    "title": "RTCC Data Integration & Intelligence Initiative"
  },
  "opportunity": {
    "solicitation_number": null,
    "posted_date": null,
    "due_date": null,
    "status": "open",
    "procurement_url": "https://example.gov/ocala-rtcc"
  },
  "funding": {
    "estimated_contract_value": null,
    "project_budget": null,
    "grant_amount": 1300000,
    "annual_support": null,
    "funding_source": "State grant request"
  },
  "competitors": [],
  "technologies": ["CAD", "video", "intelligence fusion"],
  "pain_points": ["Decentralized public-safety data sources"],
  "matched_capabilities": [
    "AI Incident Intelligence",
    "CAD Integration",
    "Live Command Maps",
    "Camera Context",
    "Cross-Agency Intelligence"
  ],
  "facts": [
    "Ocala identified decentralized public-safety data sources as an operational issue."
  ],
  "inferences": [
    "This creates a potential opportunity for NexCort iQ to operate as an intelligence aggregation layer."
  ],
  "contacts": [],
  "qualification": {
    "fit": "high",
    "strategy": "direct",
    "reason": "City is developing centralized RTCC processing and intelligence capabilities."
  },
  "next_action": "Engage OPD before grant/procurement architecture is finalized.",
  "lifecycle": {
    "change_type": "new",
    "summary": "Planning identified — grant request in development."
  },
  "evidence": [
    {
      "url": "https://example.gov/ocala-rtcc",
      "source_type": "city_agenda",
      "source_quality": "authoritative",
      "document_title": "Council agenda",
      "page": null,
      "meeting_date": "2026-05-04"
    }
  ]
}`;

export function WatchIngestAdminClient() {
  const [json, setJson] = useState(SAMPLE);
  const [mode, setMode] = useState<"validate" | "submit">("validate");
  const [result, setResult] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function run(submit: boolean) {
    setBusy(true);
    setMode(submit ? "submit" : "validate");
    setResult("");
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch (err) {
        setResult(JSON.stringify({ success: false, error: "Invalid JSON", message: String(err) }, null, 2));
        return;
      }
      if (!submit) {
        setResult(JSON.stringify({ success: true, action: "validated_locally", note: "JSON parsed. Submit to run production ingest." }, null, 2));
        return;
      }
      const res = await fetch("/api/watch/ingest", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const text = await res.text();
      try {
        setResult(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setResult(`HTTP ${res.status}\n${text}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Watch ingest tester</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Paste a WatchSignal JSON object and submit through the same production validation and
          ingestion path. Admin session is required; machine API key ingest remains{" "}
          <code className="text-slate-300">POST /api/watch/ingest</code> with Bearer auth.
        </p>
      </div>
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={24}
        className="w-full rounded-md border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-slate-200"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(false)}
          className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200"
        >
          Validate
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(true)}
          className="rounded-md bg-sky-700 px-3 py-2 text-sm font-semibold text-white"
        >
          Submit
        </button>
      </div>
      <pre className="overflow-x-auto rounded-md border border-slate-800 bg-black/40 p-3 text-xs text-slate-300">
        {result || `Ready (${mode}).`}
      </pre>
    </div>
  );
}
