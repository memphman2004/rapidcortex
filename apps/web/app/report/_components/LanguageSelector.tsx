"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const languages = [
  { code: "EN", label: "English", flag: "🇺🇸" },
  { code: "ES", label: "Spanish", flag: "🇪🇸" },
  { code: "FR", label: "French", flag: "🇫🇷" },
  { code: "PT", label: "Portuguese", flag: "🇵🇹" },
  { code: "ZH", label: "Chinese (Simplified)", flag: "🇨🇳" },
  { code: "JA", label: "Japanese", flag: "🇯🇵" },
  { code: "KO", label: "Korean", flag: "🇰🇷" },
  { code: "AR", label: "Arabic", flag: "🇸🇦" },
];

const storageKey = "rc_report_lang";

export function LanguageSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState("EN");

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved && languages.some((language) => language.code === saved)) {
      setSelectedCode(saved);
    }
  }, []);

  const selectedLanguage = languages.find((language) => language.code === selectedCode) ?? languages[0];

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex min-h-12 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
      >
        <span>{selectedLanguage.flag}</span>
        <span>{selectedLanguage.code}</span>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 bg-black/30">
          <button type="button" className="absolute inset-0" onClick={() => setIsOpen(false)} aria-label="Close" />
          <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">Select language</h2>
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
              {languages.map((language) => (
                <button
                  key={language.code}
                  type="button"
                  onClick={() => {
                    window.localStorage.setItem(storageKey, language.code);
                    console.log("TODO: set report language", language.code);
                    setSelectedCode(language.code);
                    setIsOpen(false);
                  }}
                  className="flex min-h-12 items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left text-sm text-slate-700"
                >
                  <span>
                    {language.flag} {language.label}
                  </span>
                  <span className="text-xs text-slate-400">{language.code}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
