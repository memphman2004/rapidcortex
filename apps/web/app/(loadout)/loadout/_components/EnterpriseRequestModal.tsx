"use client";

import { useState } from "react";

interface EnterpriseRequestModalProps {
  featureId: string;
  featureName: string;
  onClose: () => void;
}

export function EnterpriseRequestModal({ featureId, featureName, onClose }: EnterpriseRequestModalProps) {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/loadout/enterprise/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featureId, message }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-[#0f1117] p-6 shadow-2xl">
        {submitted ? (
          <>
            <h2 className="text-base font-semibold text-white mb-2">Request Received</h2>
            <p className="text-sm text-slate-400 mb-4">
              Our team will reach out within 1 business day about{" "}
              <strong className="text-white">{featureName}</strong>.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-slate-700 text-white rounded hover:bg-slate-600 transition-colors"
            >
              Close
            </button>
          </>
        ) : (
          <>
            <h2 className="text-base font-semibold text-white mb-1">Enterprise Inquiry</h2>
            <p className="text-sm text-slate-400 mb-4">
              <strong className="text-white">{featureName}</strong> requires custom pricing.
              Tell us about your use case and we'll follow up.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your use case, expected call volume, or any questions..."
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none"
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm bg-amber-700 text-white rounded hover:bg-amber-600 transition-colors disabled:opacity-50"
                >
                  {loading ? "Sending…" : "Send Inquiry"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
