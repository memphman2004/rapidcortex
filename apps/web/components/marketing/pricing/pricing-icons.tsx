export function IconCheck({ className = "shrink-0" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="9" cy="9" r="9" className="fill-emerald-500/15" />
      <path
        d="M5 9l2.5 2.5L13 6"
        className="stroke-emerald-400"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconDash({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-block text-slate-600 ${className}`} aria-hidden>
      —
    </span>
  );
}
