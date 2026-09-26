"use client";

import { SCORE_CONFIG, type LeadScore } from "@/lib/sales/lead-scoring";

export function LeadScoreBadge({ score }: { score: LeadScore }) {
  const cfg = SCORE_CONFIG[score.bucket];
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold",
        cfg.bg,
        cfg.border,
        cfg.color,
      ].join(" ")}
    >
      <span className={["h-1.5 w-1.5 rounded-full", cfg.dot].join(" ")} />
      {score.total} · {cfg.label}
    </span>
  );
}
