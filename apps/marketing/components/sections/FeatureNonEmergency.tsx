import type { ReactNode } from "react";

interface CallStep {
  icon: ReactNode;
  label: string;
  sublabel: string;
}

interface Outcome {
  label: string;
  description: string;
  color: string;
  icon: ReactNode;
}

interface KeyPoint {
  title: string;
  body: string;
}

function IconPhone() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
    </svg>
  );
}

function IconCpu() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 15h3M1 9h3M1 15h3" />
    </svg>
  );
}

function IconBrain() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3z" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconForward() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="15 17 20 12 15 7" />
      <path d="M4 18v-2a4 4 0 0 1 4-4h12" />
    </svg>
  );
}

function IconSpeaker() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function IconFile() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

const CALL_STEPS: CallStep[] = [
  {
    icon: <IconPhone />,
    label: "Caller dials 311",
    sublabel: "Non-emergency line — answered immediately by AI",
  },
  {
    icon: <IconCpu />,
    label: "Connect + Lex intent classification",
    sublabel: "Request type identified, key entities extracted in real time",
  },
  {
    icon: <IconBrain />,
    label: "Bedrock urgency scoring",
    sublabel: "Checks for distress language, silence patterns, medical terminology",
  },
];

const OUTCOMES: Outcome[] = [
  {
    label: "Ticket created",
    description: "Service request routed to agency workflow",
    color: "#00C87A",
    icon: <IconCheck />,
  },
  {
    label: "Live escalation",
    description: "Transferred to dispatcher immediately",
    color: "#E8192C",
    icon: <IconForward />,
  },
  {
    label: "Voice response",
    description: "Polly delivers info and closes the call",
    color: "#1469FF",
    icon: <IconSpeaker />,
  },
  {
    label: "Auto-record",
    description: "Every call logged, no manual entry needed",
    color: "#6A7B9D",
    icon: <IconFile />,
  },
];

const KEY_POINTS: KeyPoint[] = [
  {
    title: "Zero dispatcher minutes consumed",
    body: "Service requests, status inquiries, and information lines are handled end-to-end by AI. Your dispatch queue stays clear for what only a human can do.",
  },
  {
    title: "Escalation is hardwired, not configured",
    body: "Distress language, silence patterns, or medical terminology trigger immediate live transfer to a dispatcher — every time, no exceptions, no tuning required.",
  },
  {
    title: "Every call becomes a structured record",
    body: "Caller ID, issue type, location, timestamp, and AI summary are logged automatically. No manual entry. No gaps in the incident log.",
  },
];

const AWS_STACK = ["Amazon Connect", "Amazon Lex", "Amazon Bedrock", "Amazon Polly"];

function StatusDot({ color = "#00C87A" }: { color?: string }) {
  return (
    <div
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
      style={{ background: `${color}1A`, border: `1px solid ${color}40` }}
    >
      <div className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
    </div>
  );
}

function CallFlowPanel() {
  return (
    <div className="overflow-hidden rounded-xl" style={{ background: "#0B1220", border: "1px solid #1A2940" }}>
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{ borderBottom: "1px solid #1A2940", background: "#0F1830" }}
      >
        <span className="h-2 w-2 rounded-full bg-[#E8192C]" aria-hidden="true" />
        <span className="h-2 w-2 rounded-full bg-[#F0A020]" aria-hidden="true" />
        <span className="h-2 w-2 rounded-full bg-[#00C87A]" aria-hidden="true" />
        <span className="ml-2 font-mono text-[11px] text-[#3A4F72]">rc-ai-handler · non-emergency · live</span>
      </div>

      <div className="p-4">
        {CALL_STEPS.map((step, i) => (
          <div key={step.label}>
            <div className="flex items-start gap-3">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: i === 0 ? "#060910" : "rgba(20,105,255,.1)",
                  border: `1px solid ${i === 0 ? "#1A2940" : "rgba(20,105,255,.25)"}`,
                  color: i === 0 ? "#6A7B9D" : "#1469FF",
                }}
              >
                {step.icon}
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-0.5 text-sm font-medium text-[#E8EEF8]">{step.label}</div>
                <div className="text-[11px] leading-relaxed text-[#6A7B9D]">{step.sublabel}</div>
              </div>

              <StatusDot />
            </div>

            {i < CALL_STEPS.length - 1 ? (
              <div className="ml-4 py-1">
                <div
                  className="h-3.5 w-px"
                  style={{
                    background: i === 0 ? "#1A2940" : "linear-gradient(#1A2940, rgba(20,105,255,.4))",
                  }}
                />
              </div>
            ) : null}
          </div>
        ))}

        <div className="mt-5 pt-4" style={{ borderTop: "1px solid #1A2940" }}>
          <p className="mb-3 text-[10px] font-medium uppercase tracking-widest text-[#3A4F72]">
            Outcome routing
          </p>
          <div className="grid grid-cols-2 gap-2">
            {OUTCOMES.map((o) => (
              <div
                key={o.label}
                className="rounded-lg p-2.5"
                style={{
                  background: `${o.color}0D`,
                  border: `1px solid ${o.color}30`,
                }}
              >
                <div style={{ color: o.color }}>{o.icon}</div>
                <div className="mb-0.5 mt-1.5 text-[11px] font-medium" style={{ color: o.color }}>
                  {o.label}
                </div>
                <div className="text-[10px] leading-relaxed text-[#6A7B9D]">{o.description}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5 pt-3" style={{ borderTop: "1px solid #1A2940" }}>
          {AWS_STACK.map((svc) => (
            <span
              key={svc}
              className="rounded px-2 py-0.5 font-mono text-[10px] text-[#3A4F72]"
              style={{ background: "#060910", border: "1px solid #1A2940" }}
            >
              {svc}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FeatureNonEmergency() {
  return (
    <section
      id="non-emergency-ai"
      className="scroll-mt-28 bg-[#07090F] px-6 py-20 md:py-28"
      aria-labelledby="non-emergency-heading"
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <CallFlowPanel />
          </div>

          <div>
            <div className="mb-5">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  background: "rgba(232, 25, 44, 0.1)",
                  border: "1px solid rgba(232, 25, 44, 0.3)",
                  color: "#E8192C",
                }}
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#E8192C]" aria-hidden="true" />
                311 / AI non-emergency call handling
              </span>
            </div>

            <h2
              id="non-emergency-heading"
              className="rc-title-gradient mb-4 text-3xl font-semibold leading-tight md:text-4xl lg:text-5xl"
            >
              Every 311 call answered. Every dispatcher focused on 911.
            </h2>

            <p className="mb-10 text-base leading-relaxed text-[#6A7B9D] md:text-lg">
              NexCort iQ&apos;s AI handler manages non-emergency volume around the clock — classifying,
              routing, and resolving calls without dispatcher intervention. When urgency signals appear, the
              call transfers live. No caller falls through.
            </p>

            <div className="flex flex-col gap-6">
              {KEY_POINTS.map((point) => (
                <div key={point.title} className="flex items-start gap-3">
                  <div
                    className="mt-0.5 flex h-4 w-4 shrink-0 items-center"
                    style={{
                      background: "rgba(0, 200, 122, 0.10)",
                      border: "1px solid rgba(0, 200, 122, 0.25)",
                    }}
                  >
                    <div className="mx-auto h-1.5 w-1.5 rounded-full bg-[#00C87A]" />
                  </div>

                  <div>
                    <div className="mb-1 text-sm font-medium text-[#E8EEF8]">{point.title}</div>
                    <div className="text-sm leading-relaxed text-[#6A7B9D]">{point.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
