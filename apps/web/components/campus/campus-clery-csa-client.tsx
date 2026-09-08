"use client";

import { useEffect, useState } from "react";
import type { CampusSecurityAuthority, CSAReporterType } from "rapid-cortex-shared";

export function CampusCleryCsaClient({ campusCode }: { campusCode: string }) {
  const code = campusCode.toUpperCase();
  const [items, setItems] = useState<CampusSecurityAuthority[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [reporterType, setReporterType] = useState<CSAReporterType>("CAMPUS_SECURITY_STAFF");
  const [sworn, setSworn] = useState(false);
  const [badge, setBadge] = useState("");
  const [coordinator, setCoordinator] = useState(false);

  async function load() {
    const res = await fetch(`/api/campus/clery/csa?campusCode=${encodeURIComponent(code)}`, { cache: "no-store" });
    const data = (await res.json()) as { csa?: CampusSecurityAuthority[]; error?: string };
    if (!res.ok) setError(data.error || "Failed to load");
    else setItems(data.csa ?? []);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function add() {
    const res = await fetch("/api/campus/clery/csa", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        campusCode: code,
        userId,
        displayName,
        email,
        reporterType: sworn ? "SWORN_OFFICER" : reporterType,
        isSwornOfficer: sworn,
        badgeNumber: sworn ? badge : undefined,
        isCleryCoordinator: coordinator,
      }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) setError(data.error || "Save failed");
    else {
      setUserId("");
      setDisplayName("");
      setEmail("");
      await load();
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-white">Campus Security Authority registry</h1>
      <p className="text-sm text-slate-400">
        Only CSAs with reporter type SWORN_OFFICER, isSwornOfficer, and a badge number may unfound crimes — enforced
        at the API, not only in this UI.
      </p>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <div className="grid gap-2 md:grid-cols-2">
        <input className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="User id" value={userId} onChange={(e) => setUserId(e.target.value)} />
        <input className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <input className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <select className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white" value={reporterType} onChange={(e) => setReporterType(e.target.value as CSAReporterType)}>
          <option value="SWORN_OFFICER">Sworn officer</option>
          <option value="CAMPUS_SECURITY_STAFF">Campus security staff</option>
          <option value="DESIGNATED_OFFICIAL">Designated official</option>
          <option value="VOLUNTARY_CONFIDENTIAL">Voluntary confidential</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={sworn} onChange={(e) => setSworn(e.target.checked)} />
          Sworn officer
        </label>
        <input className="rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="Badge number (required if sworn)" value={badge} onChange={(e) => setBadge(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={coordinator} onChange={(e) => setCoordinator(e.target.checked)} />
          Clery Coordinator
        </label>
        <button type="button" className="rounded bg-sky-700 px-3 py-2 text-sm text-white" onClick={() => void add()}>
          Add CSA
        </button>
      </div>
      <ul className="space-y-2 text-sm text-slate-200">
        {items.map((c) => (
          <li key={c.userId} className="rounded border border-slate-800 p-2">
            {c.displayName} · {c.reporterType}
            {c.isSwornOfficer ? " · sworn" : ""} {c.badgeNumber ? `· badge on file` : ""} {c.activeTo ? "· inactive" : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
