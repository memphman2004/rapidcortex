"use client";

import { useEffect, useState } from "react";
import type { HospitalProfile } from "rapid-cortex-shared";
import { fetchHospitals } from "@/lib/emergency-connect/api";

export function HospitalDirectory() {
  const [hospitals, setHospitals] = useState<HospitalProfile[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHospitals()
      .then(setHospitals)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load hospitals"));
  }, []);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (hospitals.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No hospitals configured for this agency. Agency admins can add destinations under
        Emergency Connect settings.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
      {hospitals.map((h) => (
        <li key={h.hospitalId} className="px-4 py-3">
          <p className="font-medium text-slate-900">{h.name}</p>
          <p className="text-sm text-slate-600">{h.address}</p>
          <p className="mt-1 text-xs text-slate-500">
            {h.traumaLevel ? `Trauma ${h.traumaLevel.replace("_", " ")}` : "Trauma not rated"}
            {h.strokeCenter ? " · Stroke center" : ""}
            {h.cardiacCenter ? " · Cardiac center" : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
