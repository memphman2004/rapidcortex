import { COPYRIGHT } from "@/lib/copyright";

export function CopyrightBanner() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#0a0f1e] px-8 py-5">
      <p className="m-0 text-center text-[11px] leading-relaxed text-slate-500">
        {COPYRIGHT.notice(true)}
        <br />
        Unauthorized copying or reproduction of content, language, design, or feature descriptions
        is prohibited and may be monitored.
      </p>
    </footer>
  );
}
