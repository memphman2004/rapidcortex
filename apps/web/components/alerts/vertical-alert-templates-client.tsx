"use client";

import { useEffect, useState } from "react";
import type { AlertTemplate, AlertVertical } from "rapid-cortex-shared";

export function VerticalAlertTemplatesClient({ vertical }: { vertical: AlertVertical }) {
  const [templates, setTemplates] = useState<AlertTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/alerts/templates?vertical=${encodeURIComponent(vertical)}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as { templates?: AlertTemplate[]; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Failed to load");
        setTemplates(data.templates ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, [vertical]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">Alert templates</h2>
      <p className="text-sm text-slate-400">
        System templates cannot change type or severity. SMS bodies stay at or under 160 characters.
        Never promise that help is on the way without a human confirmation.
      </p>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <ul className="space-y-3">
        {templates.map((t) => (
          <li key={t.templateId} className="rounded border border-slate-700 bg-slate-900/50 p-3">
            <p className="text-sm font-semibold text-white">
              {t.title}{" "}
              <span className="text-xs font-normal text-slate-400">
                {t.type} · {t.severity}
                {t.system ? " · system" : ""}
              </span>
            </p>
            <p className="mt-1 text-sm text-slate-300">{t.body}</p>
            <p className="mt-2 text-xs text-slate-500">SMS ({t.smsBody.length}/160): {t.smsBody}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
