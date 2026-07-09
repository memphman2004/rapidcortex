"use client";

import { useEffect, useRef, useState } from "react";
import { Phone } from "lucide-react";
import { formatPhoneDisplay, isValidUSPhone, maskPhoneInput, toE164 } from "rapid-cortex-shared";

type PhoneInputProps = {
  /** E.164 from incoming call ANI — pre-fills the field when provided */
  ani?: string | null;
  label?: string;
  /** Called with E.164 on every valid change; null when incomplete or invalid */
  onChange: (e164: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

export function PhoneInput({
  ani,
  label = "Phone number",
  onChange,
  disabled = false,
  placeholder = "(___) ___-____",
  className,
}: PhoneInputProps) {
  const [display, setDisplay] = useState("");
  const [fromAni, setFromAni] = useState(false);
  const [touched, setTouched] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const prevAni = useRef<string | null | undefined>(undefined);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (ani === prevAni.current) return;
    prevAni.current = ani;

    if (ani) {
      setDisplay(formatPhoneDisplay(ani));
      setFromAni(true);
      setTouched(false);
      onChangeRef.current(ani);
    } else {
      setDisplay("");
      setFromAni(false);
      onChangeRef.current(null);
    }
  }, [ani]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const masked = maskPhoneInput(e.target.value);
    setDisplay(masked);
    setFromAni(false);
    onChangeRef.current(toE164(masked));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Backspace") return;
    const pos = inputRef.current?.selectionStart ?? display.length;
    const charBefore = display[pos - 1];
    if (charBefore === " " || charBefore === ")" || charBefore === "-") {
      e.preventDefault();
      const newDisplay = display.slice(0, pos - 2) + display.slice(pos);
      const masked = maskPhoneInput(newDisplay);
      setDisplay(masked);
      onChangeRef.current(toE164(masked));
    }
  }

  const isValid = isValidUSPhone(display);
  const showError = touched && display.length > 0 && !isValid;

  return (
    <div className={className}>
      <div className="mb-1 flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        {fromAni ? (
          <span className="rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-400">
            FROM CALL
          </span>
        ) : null}
      </div>

      <div className="relative">
        <Phone
          className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${
            isValid && touched ? "text-emerald-400" : "text-slate-500"
          }`}
          aria-hidden
        />
        <input
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          value={display}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={() => setTouched(true)}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={14}
          className={`w-full rounded-md border bg-slate-950 py-2 pl-9 pr-3 text-sm tabular-nums tracking-wide text-slate-100 outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            showError
              ? "border-rose-500/60 focus:border-rose-400"
              : isValid && touched
                ? "border-emerald-500/40 focus:border-emerald-400"
                : "border-slate-700 focus:border-sky-500"
          }`}
        />
      </div>

      {showError ? (
        <p className="mt-1 text-[11px] text-rose-400">Enter a 10-digit US phone number</p>
      ) : null}
    </div>
  );
}
