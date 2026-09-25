"use client";

export function SalesLibrary() {
  const sections = [
    {
      title: "Permanent free tier framing",
      body: "Do not call it a free trial. Community Connect, complimentary intelligence reports, and Wellness are permanent or selective free offerings that create awareness of capability gaps.",
    },
    {
      title: "Community Tip Line (Campus + Venue)",
      body: "One QR, one zone, email forwarding only. Upsell: console, two-way chat, Clery, analytics, multi-zone, NFC.",
    },
    {
      title: "Agency Intelligence Scan (all verticals)",
      body: "One-time anonymized CAD export → PDF. Limited availability. Follow with peak-window demo of full iQ.",
    },
    {
      title: "Dispatcher Wellness (911)",
      body: "Anonymous aggregate check-ins. Upsell: individual data, call correlation, scheduling, peer support, command reporting.",
    },
    {
      title: "Never free",
      body: "Live transcription, AI triage/confidence scoring, and CAD write-back stay paid-only.",
    },
    {
      title: "Conversion path",
      body: "Register free → 30–60 days real use → hit ceiling → upgrade demo → pilot → reference account.",
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {sections.map((s) => (
        <article key={s.title} className="rounded-xl border border-white/5 bg-[#0a1628] p-4">
          <h3 className="text-sm font-semibold text-white">{s.title}</h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">{s.body}</p>
        </article>
      ))}
    </div>
  );
}
