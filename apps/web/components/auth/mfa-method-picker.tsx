"use client";

export type MfaMethodChoice = "email" | "authenticator";

type MfaMethodPickerProps = {
  accountLabel: string;
  /** When set, hide options Cognito did not offer. */
  allowed?: ReadonlyArray<"email" | "authenticator" | "sms">;
  onChoose: (choice: MfaMethodChoice) => void;
  disabled?: boolean;
};

function isAllowed(
  choice: MfaMethodChoice,
  allowed: MfaMethodPickerProps["allowed"],
): boolean {
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(choice);
}

/** Choose email 6-digit code vs authenticator app during MFA setup / SELECT_MFA_TYPE. */
export function MfaMethodPicker({
  accountLabel,
  allowed,
  onChoose,
  disabled,
}: MfaMethodPickerProps) {
  const showEmail = isAllowed("email", allowed);
  const showAuth = isAllowed("authenticator", allowed);

  return (
    <>
      <p className="rc-login-hint">
        Account: <span className="font-mono text-[#e2ecf8]">{accountLabel}</span>
      </p>
      <p className="rc-login-hint">Choose how you want to verify sign-in:</p>
      <div className="rc-login-mfa-choice-list" role="group" aria-label="MFA method">
        {showEmail ? (
          <button
            type="button"
            className="rc-login-mfa-choice"
            disabled={disabled}
            onClick={() => onChoose("email")}
          >
            <span className="rc-login-mfa-choice-title">Email me a 6-digit code</span>
            <span className="rc-login-mfa-choice-desc">
              We send a code to your account email each time you sign in.
            </span>
          </button>
        ) : null}
        {showAuth ? (
          <button
            type="button"
            className="rc-login-mfa-choice"
            disabled={disabled}
            onClick={() => onChoose("authenticator")}
          >
            <span className="rc-login-mfa-choice-title">Use an authenticator app</span>
            <span className="rc-login-mfa-choice-desc">
              Google Authenticator, Microsoft Authenticator, or any TOTP app.
            </span>
          </button>
        ) : null}
      </div>
    </>
  );
}

/** Map Cognito MFAS_CAN_* strings to picker options. */
export function mfaOptionsFromCognitoList(list: string[] | undefined): Array<"email" | "authenticator" | "sms"> {
  if (!list?.length) return ["email", "authenticator"];
  const out: Array<"email" | "authenticator" | "sms"> = [];
  for (const raw of list) {
    const u = raw.toUpperCase();
    if (u.includes("EMAIL")) out.push("email");
    else if (u.includes("SOFTWARE") || u.includes("TOTP") || u.includes("TOKEN")) out.push("authenticator");
    else if (u.includes("SMS")) out.push("sms");
  }
  return out.length ? out : ["email", "authenticator"];
}
