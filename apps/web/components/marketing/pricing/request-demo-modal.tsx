"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { marketingDemoRequestPath } from "@/lib/marketing-links";
import { PRICING_DEMO_MAILTO } from "@/lib/marketing/pricing-content";
import { SITE_NAME } from "@/lib/site";

const MODAL_Z = 200;

export function RequestDemoModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  if (typeof document === "undefined" || !mounted) return null;

  const tree = (
    <div
      className="fixed inset-0 flex items-end justify-center p-4 sm:items-center"
      style={{ zIndex: MODAL_Z }}
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl shadow-black/50"
        style={{ zIndex: MODAL_Z + 1 }}
      >
        <h2 id={titleId} className="text-lg font-semibold text-white">
          Request a demo
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          Share your agency context with the {SITE_NAME} team. We will follow up to schedule a
          tailored walkthrough—no public card checkout, no surprise scope.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href={marketingDemoRequestPath("demo")}
            className="inline-flex flex-1 items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
            onClick={onClose}
          >
            Submit demo request
          </Link>
          <a
            href={PRICING_DEMO_MAILTO}
            className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-200 hover:border-slate-500"
          >
            Email instead
          </a>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-200 hover:border-slate-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(tree, document.body);
}
