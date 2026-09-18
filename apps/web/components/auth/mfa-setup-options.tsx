"use client";

import { useEffect, useState } from "react";

type MfaSetupOptionsProps = {
  accountLabel: string;
  totpSecret: string;
  otpauthUrl: string;
  totpCode: string;
  onTotpCodeChange: (value: string) => void;
};

/** First-login TOTP enrollment with Google Authenticator (QR stays on this page). */
export function MfaSetupOptions({
  accountLabel,
  totpSecret,
  otpauthUrl,
  totpCode,
  onTotpCodeChange,
}: MfaSetupOptionsProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const QRCode = await import("qrcode");
      const dataUrl = await QRCode.toDataURL(otpauthUrl, {
        width: 196,
        margin: 2,
        color: { dark: "#0f1117", light: "#FFFFFF" },
        errorCorrectionLevel: "M",
      });
      if (!cancelled) setQrDataUrl(dataUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [otpauthUrl]);

  return (
    <>
      <p className="rc-login-hint">
        Account: <span className="font-mono text-[#e2ecf8]">{accountLabel}</span>
      </p>
      <div className="rc-login-mfa-panel">
        <ol className="rc-login-mfa-steps">
          <li>Open Google Authenticator on your phone (App Store or Google Play).</li>
          <li>Tap + and scan this QR — stay on this page.</li>
          <li>Enter the 6-digit code below.</li>
        </ol>
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="QR code for Google Authenticator"
            className="rc-login-mfa-qr"
            width={196}
            height={196}
          />
        ) : (
          <p className="rc-login-hint">Preparing QR code…</p>
        )}
      </div>
      <label className="rc-login-field">
        <span className="rc-login-label">Secret (manual entry)</span>
        <input readOnly value={totpSecret} className="rc-login-input font-mono text-xs" />
      </label>
      <label className="rc-login-field">
        <span className="rc-login-label">6-digit code</span>
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={12}
          required
          value={totpCode}
          onChange={(e) => onTotpCodeChange(e.target.value.replace(/\D/g, ""))}
          className="rc-login-input"
        />
      </label>
    </>
  );
}
