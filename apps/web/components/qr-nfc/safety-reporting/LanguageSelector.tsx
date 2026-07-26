"use client";

import { useState } from "react";
import { X } from "lucide-react";
import {
  REPORT_LANGUAGES,
  useReportLanguage,
  type ReportLangCode,
} from "@/components/intake/report-language";

export function LanguageSelector({ variant = "light" }: { variant?: "light" | "dark" }) {
  const [isOpen, setIsOpen] = useState(false);
  const { code, setCode, t } = useReportLanguage();

  const selectedLanguage = REPORT_LANGUAGES.find((language) => language.code === code) ?? REPORT_LANGUAGES[0];
  const isDark = variant === "dark";

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={
          isDark
            ? "inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 text-sm font-semibold text-white backdrop-blur-sm"
            : "inline-flex min-h-12 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
        }
        aria-label={`Language: ${selectedLanguage.label}`}
      >
        <span aria-hidden>{selectedLanguage.flag}</span>
        <span>{selectedLanguage.code}</span>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 bg-black/30">
          <button type="button" className="absolute inset-0" onClick={() => setIsOpen(false)} aria-label="Close" />
          <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">{t("selectLanguage")}</h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200"
                aria-label="Close language picker"
              >
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>
            <div className="grid gap-2">
              {REPORT_LANGUAGES.map((language) => {
                const selected = language.code === code;
                return (
                  <button
                    key={language.code}
                    type="button"
                    onClick={() => {
                      setCode(language.code as ReportLangCode);
                      setIsOpen(false);
                    }}
                    className="flex min-h-12 items-center justify-between rounded-xl border px-4 py-3 text-left text-sm"
                    style={{
                      borderColor: selected ? "#2563eb" : "#e2e8f0",
                      background: selected ? "#eff6ff" : "white",
                      color: "#334155",
                      fontWeight: selected ? 600 : 400,
                    }}
                    aria-pressed={selected}
                  >
                    <span>
                      {language.flag} {language.label}
                    </span>
                    <span className="text-xs text-slate-400">{language.code}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
