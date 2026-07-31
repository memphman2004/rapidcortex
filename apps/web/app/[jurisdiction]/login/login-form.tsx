"use client";

import type { UserContext } from "rapid-cortex-shared";
import type { LoginQuerySnapshot } from "@/lib/auth/login-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/auth/session-context";
import { isPublicSignupUiEnabled } from "@/lib/auth/public-signup";
import { isAuthConfigured } from "@/lib/auth/roles";
import {
  marketingContactPath,
  marketingHomePath,
  marketingPricingPath,
  marketingRingCustomersPath,
  marketingSignupPath,
} from "@/lib/marketing-links";
import { RING_TM } from "@/lib/brand-marks";
import { postAuthRedirect, hardNavigateTo } from "@/lib/auth/postAuthRedirect";
import {
  resolvePostLoginNavigationHref,
  resolvePostLoginNavigationHrefAfterPasswordChange,
} from "@/lib/auth/post-login-redirect";
import {
  buildNativeDesktopCognitoAuthorizeUrl,
  persistNativeDesktopOAuthPkce,
} from "@/lib/auth/native-desktop-oauth";
import { ensureCsrfCookie, jsonHeadersWithCsrf } from "@/lib/csrf-client";
import { COGNITO_PASSWORD_REQUIREMENTS, isValidCognitoPassword } from "@/lib/auth/cognito-password-policy";
import { useJurisdictionSlug } from "@/lib/jurisdiction-context";
import { Eye, EyeOff } from "lucide-react";

type AuthChallenge =
  | "NEW_PASSWORD_REQUIRED"
  | "MFA_SETUP"
  | "EMAIL_OTP"
  | "SOFTWARE_TOKEN_MFA"
  | "SMS_MFA";

const AUTH_SESSION_REFRESH_ATTEMPTS = 8;

/** Small backoff so Set-Cookie from `/api/auth/*` is visible to the following `/api/auth/session`. */
async function refreshSessionAfterSignIn(
  refresh: () => Promise<UserContext | null>,
): Promise<UserContext | null> {
  for (let i = 0; i < AUTH_SESSION_REFRESH_ATTEMPTS; i++) {
    const next = await refresh();
    if (next) return next;
    await new Promise((r) => setTimeout(r, 45 + i * 40));
  }
  return null;
}

export function LoginForm({
  loginQuery,
  signInConfigured,
}: {
  loginQuery: LoginQuerySnapshot;
  /**
   * Passed from the login RSC parent. `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID` are not exposed to
   * the browser — without this, `isAuthConfigured()` would always be false client-side and hide the form.
   */
  signInConfigured?: boolean;
}) {
  const router = useRouter();
  const jurisdictionSlug = useJurisdictionSlug();
  const { user, isLoading, refresh } = useSession();
  const signupEnabled = isPublicSignupUiEnabled();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [authSession, setAuthSession] = useState<string | null>(null);
  const [challengeUsername, setChallengeUsername] = useState<string | null>(null);
  const [activeChallenge, setActiveChallenge] = useState<AuthChallenge | null>(null);
  const [mfaLoginChallenge, setMfaLoginChallenge] = useState<"SOFTWARE_TOKEN_MFA" | "SMS_MFA" | null>(null);
  const [mfaAssociateSession, setMfaAssociateSession] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [mfaLoginCode, setMfaLoginCode] = useState("");
  const [associateError, setAssociateError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [forgotStep, setForgotStep] = useState<"idle" | "request" | "confirm">("idle");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotNewPasswordConfirm, setForgotNewPasswordConfirm] = useState("");
  const [forgotInfoMessage, setForgotInfoMessage] = useState<string | null>(null);
  const [passwordResetNoticeVisible, setPasswordResetNoticeVisible] = useState(loginQuery.passwordReset);
  /** Dev-only: safe auth diagnostics (no tokens). */
  const [authDbg, setAuthDbg] = useState({
    step: "idle",
    sessionPresent: false as boolean,
    role: "—",
    redirectTarget: "—",
    lastError: "—",
  });

  const homePathFor = useCallback(
    (sessionUser: UserContext | null, afterPasswordChange = false): string | null => {
      if (!sessionUser) return null;
      return afterPasswordChange
        ? resolvePostLoginNavigationHrefAfterPasswordChange(
            sessionUser,
            loginQuery.from,
            jurisdictionSlug,
          )
        : resolvePostLoginNavigationHref(sessionUser, loginQuery.from, jurisdictionSlug);
    },
    [loginQuery.from, jurisdictionSlug],
  );

  const tryRedirectNativeDesktopOAuth = useCallback(
    (sessionUser: UserContext | null): boolean => {
      if (!sessionUser || !loginQuery.nativeDesktopOAuth) return false;
      try {
        persistNativeDesktopOAuthPkce(loginQuery.nativeDesktopOAuth);
        window.location.assign(
          buildNativeDesktopCognitoAuthorizeUrl(loginQuery.nativeDesktopOAuth, { prompt: "none" }),
        );
        return true;
      } catch (e) {
        console.error("[login] native desktop OAuth continue failed", e);
        return false;
      }
    },
    [loginQuery.nativeDesktopOAuth],
  );

  useEffect(() => {
    if (!isLoading && user) {
      if (tryRedirectNativeDesktopOAuth(user)) return;
      const path = homePathFor(user);
      if (path) hardNavigateTo(path);
    }
  }, [isLoading, user, homePathFor, tryRedirectNativeDesktopOAuth]);

  useEffect(() => {
    if (!loginQuery.passwordReset) return;
    router.replace(`/${jurisdictionSlug}/login`);
  }, [jurisdictionSlug, loginQuery.passwordReset, router]);

  function navigatePostAuth(
    sessionUser: UserContext | null,
    ctx: string,
    opts?: { afterPasswordChange?: boolean; preferredPath?: string | null },
  ) {
    if (tryRedirectNativeDesktopOAuth(sessionUser)) return;
    const path =
      opts?.preferredPath?.startsWith("/")
        ? opts.preferredPath
        : homePathFor(sessionUser, opts?.afterPasswordChange);
    const isProd = process.env.NODE_ENV === "production";
    if (!isProd) {
      console.info("[login]", {
        phase: ctx,
        sessionPresent: Boolean(sessionUser),
        role: sessionUser?.role ?? null,
        redirectTarget: path,
      });
      setAuthDbg({
        step: ctx,
        sessionPresent: Boolean(sessionUser),
        role: sessionUser?.role ?? "(none)",
        redirectTarget: path ?? "/unauthorized?reason=session",
        lastError: "—",
      });
    }
    if (sessionUser && path) {
      postAuthRedirect(router, path);
      return;
    }
    hardNavigateTo("/unauthorized?reason=session");
  }

  const resetForgotPassword = useCallback(() => {
    setForgotStep("idle");
    setForgotCode("");
    setForgotNewPassword("");
    setForgotNewPasswordConfirm("");
    setForgotInfoMessage(null);
  }, []);

  const resetChallenges = useCallback(() => {
    setAuthSession(null);
    setChallengeUsername(null);
    setActiveChallenge(null);
    setMfaLoginChallenge(null);
    setMfaAssociateSession(null);
    setTotpSecret(null);
    setTotpCode("");
    setMfaLoginCode("");
    setAssociateError(null);
    setNewPassword("");
    setNewPasswordConfirm("");
  }, []);

  const handleChallengeJson = useCallback(
    async (res: Response) => {
      const body = (await res.json().catch(() => null)) as {
        challenge?: AuthChallenge;
        session?: string;
        username?: string;
        error?: string;
      } | null;
      if (!body?.session || !body.username || !body.challenge) {
        setError(body?.error ?? "Unexpected sign-in response");
        return;
      }
      setAuthSession(body.session);
      setChallengeUsername(body.username);
      setActiveChallenge(body.challenge);
      if (body.challenge === "SOFTWARE_TOKEN_MFA" || body.challenge === "SMS_MFA") {
        setMfaLoginChallenge(body.challenge);
      } else {
        setMfaLoginChallenge(null);
      }
      setError(null);
    },
    [],
  );

  useEffect(() => {
    if (activeChallenge !== "MFA_SETUP" || !authSession || totpSecret) return;
    let cancelled = false;
    void (async () => {
      try {
        await ensureCsrfCookie();
        const res = await fetch("/api/auth/mfa/associate", {
          method: "POST",
          headers: jsonHeadersWithCsrf(),
          credentials: "include",
          body: JSON.stringify({ session: authSession }),
        });
        const data = (await res.json().catch(() => null)) as {
          secretCode?: string;
          session?: string;
          error?: string;
        } | null;
        if (cancelled) return;
        if (!res.ok || !data?.secretCode || !data.session) {
          setAssociateError(data?.error ?? "Could not start authenticator setup");
          return;
        }
        setTotpSecret(data.secretCode);
        setMfaAssociateSession(data.session);
        setAssociateError(null);
      } catch {
        if (!cancelled) setAssociateError("Could not start authenticator setup");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeChallenge, authSession, totpSecret]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await ensureCsrfCookie();
      if (activeChallenge === "NEW_PASSWORD_REQUIRED" && authSession && challengeUsername) {
        if (newPassword !== newPasswordConfirm) {
          setError("New passwords do not match");
          return;
        }
        if (newPassword.length < 12) {
          setError(
            "Password must be at least 12 characters with uppercase, lowercase, a number, and a symbol",
          );
          return;
        }
        const res = await fetch("/api/auth/complete-new-password", {
          method: "POST",
          headers: jsonHeadersWithCsrf(),
          credentials: "include",
          body: JSON.stringify({
            username: challengeUsername,
            newPassword,
            session: authSession,
          }),
        });
        if (res.status === 202) {
          await handleChallengeJson(res);
          return;
        }
        const body = (await res.json().catch(() => null)) as
          | {
              error?: string;
              user?: UserContext | null;
            }
          | null;
        if (!res.ok) {
          setError(body?.error ?? "Could not set password");
          return;
        }
        resetChallenges();
        const refreshedUser = await refreshSessionAfterSignIn(refresh);
        const destinationUser = refreshedUser ?? body?.user ?? null;
        if (!destinationUser) {
          setError(
            "Password saved, but your session could not be loaded. Sign in again with your new password.",
          );
          return;
        }
        navigatePostAuth(destinationUser, "complete_new_password", { afterPasswordChange: true });
        return;
      }

      if (activeChallenge === "EMAIL_OTP" && authSession && challengeUsername) {
        const res = await fetch("/api/auth/email-otp", {
          method: "POST",
          headers: jsonHeadersWithCsrf(),
          credentials: "include",
          body: JSON.stringify({
            session: authSession,
            username: challengeUsername,
            code: mfaLoginCode.trim(),
          }),
        });
        if (res.status === 202) {
          await handleChallengeJson(res);
          return;
        }
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(body?.error ?? "Invalid email code");
          return;
        }
        resetChallenges();
        const uEmail = await refreshSessionAfterSignIn(refresh);
        navigatePostAuth(uEmail, "email_otp");
        return;
      }

      if (
        (activeChallenge === "SOFTWARE_TOKEN_MFA" || activeChallenge === "SMS_MFA") &&
        authSession &&
        challengeUsername &&
        mfaLoginChallenge
      ) {
        const res = await fetch("/api/auth/mfa/verify-login", {
          method: "POST",
          headers: jsonHeadersWithCsrf(),
          credentials: "include",
          body: JSON.stringify({
            session: authSession,
            username: challengeUsername,
            code: mfaLoginCode.trim(),
            challenge: mfaLoginChallenge,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(body?.error ?? "Invalid code");
          return;
        }
        resetChallenges();
        const u2 = await refreshSessionAfterSignIn(refresh);
        navigatePostAuth(u2, "mfa_login");
        return;
      }

      if (activeChallenge === "MFA_SETUP" && mfaAssociateSession && challengeUsername) {
        const trimmed = totpCode.trim();
        if (trimmed.length < 6) {
          setError("Enter the 6-digit code from your authenticator app");
          return;
        }
        const res = await fetch("/api/auth/mfa/complete-setup", {
          method: "POST",
          headers: jsonHeadersWithCsrf(),
          credentials: "include",
          body: JSON.stringify({
            session: mfaAssociateSession,
            userCode: trimmed,
            username: challengeUsername,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(body?.error ?? "Could not verify authenticator");
          return;
        }
        resetChallenges();
        const u3 = await refreshSessionAfterSignIn(refresh);
        navigatePostAuth(u3, "mfa_setup");
        return;
      }

      if (forgotStep === "confirm" && !activeChallenge) {
        if (forgotNewPassword !== forgotNewPasswordConfirm) {
          setError("New passwords do not match");
          return;
        }
        if (!isValidCognitoPassword(forgotNewPassword)) {
          setError(`Password does not meet requirements: ${COGNITO_PASSWORD_REQUIREMENTS}`);
          return;
        }
        const trimmedEmail = email.trim();
        if (!trimmedEmail || !forgotCode.trim()) {
          setError("Email and verification code are required");
          return;
        }
        const res = await fetch("/api/auth/confirm-forgot-password", {
          method: "POST",
          headers: jsonHeadersWithCsrf(),
          credentials: "include",
          body: JSON.stringify({
            email: trimmedEmail,
            code: forgotCode.trim(),
            newPassword: forgotNewPassword,
          }),
        });
        if (res.status === 202) {
          resetForgotPassword();
          await handleChallengeJson(res);
          return;
        }
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(body?.error ?? "Could not reset password");
          return;
        }
        resetForgotPassword();
        resetChallenges();
        setPasswordResetNoticeVisible(true);
        router.replace(`/${jurisdictionSlug}/login?passwordReset=true`);
        return;
      }

      if (forgotStep === "request" && !activeChallenge) {
        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
          setError("Enter your email address");
          return;
        }
        const res = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: jsonHeadersWithCsrf(),
          credentials: "include",
          body: JSON.stringify({ email: trimmedEmail }),
        });
        const body = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
        if (!res.ok) {
          setError(body?.error ?? "Could not start password reset");
          return;
        }
        setForgotInfoMessage(body?.message ?? null);
        setForgotStep("confirm");
        setForgotCode("");
        setForgotNewPassword("");
        setForgotNewPasswordConfirm("");
        setError(null);
        return;
      }

      const trimmedSignInEmail = email.trim();
      if (!trimmedSignInEmail) {
        setError("Enter your email address");
        return;
      }
      if (!password) {
        setError("Enter your password");
        return;
      }

      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: jsonHeadersWithCsrf(),
        credentials: "include",
        body: JSON.stringify({ email: trimmedSignInEmail, password }),
      });
      if (res.status === 202) {
        await handleChallengeJson(res);
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Sign in failed");
        if (process.env.NODE_ENV !== "production") {
          setAuthDbg((d) => ({
            ...d,
            step: "signin_failed",
            lastError: body?.error ?? `http_${res.status}`,
          }));
        }
        return;
      }
      const signInBody = (await res.json().catch(() => ({}))) as { redirectTo?: string };
      resetChallenges();
      const u4 = await refreshSessionAfterSignIn(refresh);
      if (!u4) {
        setError(
          "Signed in, but your workspace session could not be loaded. Common causes: this site’s server is still pointed at a different Cognito pool or client than your user pool, or your Cognito profile is missing required claims (for example custom:agencyId). For internal test users without billing SKUs, set custom:customerType=platform_internal.",
        );
        return;
      }
      navigatePostAuth(u4, "password_signin", { preferredPath: signInBody.redirectTo });
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error && err.message
          ? `Request failed: ${err.message}`
          : "Request failed. Check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const sessionNotice = loginQuery.notice;

  const authReady = signInConfigured ?? isAuthConfigured();
  if (!authReady) {
    return (
      <div className="rc-login-card">
        <div className="rc-login-card__header">
          <h1 className="rc-login-card__title">Sign-in is not available on this host yet</h1>
        </div>
        <p className="rc-login-note">
          Ask your deployment operator or Rapid Cortex administrator to finish secure sign-in configuration. If you need
          access or a pilot workspace, reach out and we will help route you to the correct environment.
        </p>
        <div className="rc-login-card__footer">
          <div className="rc-login-card__links">
            <Link href={marketingHomePath()}>Home</Link>
            <span className="rc-login-card__links-sep" aria-hidden>
              ·
            </span>
            <Link href={marketingContactPath()}>Contact us</Link>
            <span className="rc-login-card__links-sep" aria-hidden>
              ·
            </span>
            {signupEnabled ? <Link href={marketingSignupPath()}>Sign up</Link> : null}
            {signupEnabled ? (
              <span className="rc-login-card__links-sep" aria-hidden>
                ·
              </span>
            ) : null}
            <Link href={marketingPricingPath()}>Plans</Link>
          </div>
        </div>
      </div>
    );
  }

  const inNewPassword = activeChallenge === "NEW_PASSWORD_REQUIRED";
  const inMfaSetup = activeChallenge === "MFA_SETUP";
  const inEmailOtp = activeChallenge === "EMAIL_OTP";
  const inMfaLogin = activeChallenge === "SOFTWARE_TOKEN_MFA" || activeChallenge === "SMS_MFA";
  const inForgotRequest = forgotStep === "request";
  const inForgotConfirm = forgotStep === "confirm";
  const justConfirmed = loginQuery.signupJustConfirmed;
  const justVerified = loginQuery.signupJustVerified;
  const otpauthUrl =
    totpSecret && challengeUsername
      ? `otpauth://totp/${encodeURIComponent("Rapid Cortex")}:${encodeURIComponent(challengeUsername)}?secret=${encodeURIComponent(totpSecret)}&issuer=${encodeURIComponent("Rapid Cortex")}`
      : null;

  const cardTitle = inNewPassword
    ? "Set a new password"
    : inMfaSetup
      ? "Set up authenticator (required)"
      : inEmailOtp
        ? "Enter email verification code"
        : inMfaLogin
          ? activeChallenge === "SMS_MFA"
            ? "Enter SMS code"
            : "Enter authenticator code"
          : inForgotConfirm
            ? "Reset your password"
            : inForgotRequest
              ? "Forgot password"
              : "Sign in";

  const cardNote = inNewPassword
    ? "Your account requires a new password before you can continue to your secure workspace."
    : inMfaSetup
      ? "Rapid Cortex requires two-factor authentication. Add this account to an app such as Google Authenticator or 1Password, then enter the 6-digit code."
      : inEmailOtp
        ? "A one-time code was sent to your account email. Enter it below to finish signing in."
        : inMfaLogin
          ? activeChallenge === "SMS_MFA"
            ? "Enter the one-time code sent to your phone."
            : "Open your authenticator app and enter the current 6-digit code."
          : inForgotConfirm
            ? "Enter the verification code from your email and choose a new password that meets the requirements below."
            : inForgotRequest
              ? "Enter the email you use to sign in. If an account exists, we will send a verification code."
              : "Your account is configured by your administrator with the correct organization and permissions so operational data stays aligned to your agency.";

  return (
    <div className="rc-login-card">
      <div className="rc-login-card__header">
        <h1 className="rc-login-card__title">{cardTitle}</h1>
        {!inNewPassword && !inMfaSetup && !inMfaLogin && !inEmailOtp && !inForgotRequest && !inForgotConfirm ? (
          <div className="rc-login-secure-badge">
            <span className="rc-login-secure-badge__dot" aria-hidden />
            <span className="rc-login-secure-badge__label">Secure</span>
          </div>
        ) : null}
      </div>

      <p className="rc-login-note">{cardNote}</p>

      {!inNewPassword && !inMfaSetup && !inMfaLogin && (justConfirmed || justVerified) ? (
        <p className="rc-login-banner-success">
          {justConfirmed
            ? "Email confirmed. You can sign in now."
            : "Account verified. You can sign in now."}
        </p>
      ) : null}
      {!inNewPassword && !inMfaSetup && !inMfaLogin && passwordResetNoticeVisible ? (
        <p className="rc-login-banner-success">
          Password reset successfully. Please sign in with your new password.
        </p>
      ) : null}
      {sessionNotice === "dashboard_required" ? (
        <p className="rc-login-banner-warn">
          Your account does not currently have Rapid Cortex dashboard access. Contact your agency administrator or Rapid
          Cortex support.
        </p>
      ) : null}
      {sessionNotice === "rc_lite_portal" ? (
        <p className="rc-login-banner-info">
          Your account has RC Lite API access. Use the RC Lite portal to manage API clients, usage, webhooks, and
          documentation.
        </p>
      ) : null}
      {sessionNotice === "no_product" ? (
        <p className="rc-login-banner-info">
          Your account is active, but no product access has been assigned yet.
        </p>
      ) : null}

      <form noValidate onSubmit={onSubmit}>
        {!inNewPassword && !inMfaSetup && !inMfaLogin && !inEmailOtp && !inForgotRequest && !inForgotConfirm ? (
          <>
            <label className="rc-login-field">
              <span className="rc-login-label">Email</span>
              <input
                type="email"
                autoComplete="username"
                required
                placeholder="you@agency.gov"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rc-login-input"
              />
            </label>
            <label className="rc-login-field">
              <span className="rc-login-label">Password</span>
              <div className="rc-login-password-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rc-login-input rc-login-input--password"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="rc-login-password-toggle"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 shrink-0" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4 shrink-0" aria-hidden />
                  )}
                </button>
              </div>
            </label>
            <button
              type="button"
              className="rc-login-forgot"
              onClick={() => {
                setForgotStep("request");
                setForgotInfoMessage(null);
                setForgotCode("");
                setForgotNewPassword("");
                setForgotNewPasswordConfirm("");
                setError(null);
              }}
            >
              Forgot password?
            </button>
          </>
        ) : null}

        {inForgotRequest ? (
          <label className="rc-login-field">
            <span className="rc-login-label">Email</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rc-login-input"
            />
          </label>
        ) : null}

        {inForgotConfirm ? (
          <>
            {forgotInfoMessage ? <p className="rc-login-banner-info">{forgotInfoMessage}</p> : null}
            <label className="rc-login-field">
              <span className="rc-login-label">Email</span>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rc-login-input"
              />
            </label>
            <label className="rc-login-field">
              <span className="rc-login-label">Verification code</span>
              <input
                type="text"
                autoComplete="one-time-code"
                required
                value={forgotCode}
                onChange={(e) => setForgotCode(e.target.value)}
                className="rc-login-input"
              />
            </label>
            <label className="rc-login-field">
              <span className="rc-login-label">New password</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                value={forgotNewPassword}
                onChange={(e) => setForgotNewPassword(e.target.value)}
                className="rc-login-input"
              />
            </label>
            <label className="rc-login-field">
              <span className="rc-login-label">Confirm new password</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                value={forgotNewPasswordConfirm}
                onChange={(e) => setForgotNewPasswordConfirm(e.target.value)}
                className="rc-login-input"
              />
            </label>
            <p className="rc-login-hint">{COGNITO_PASSWORD_REQUIREMENTS}</p>
          </>
        ) : null}

        {inNewPassword ? (
          <>
            <p className="rc-login-hint">
              Account: <span className="font-mono text-[#e2ecf8]">{challengeUsername}</span>
            </p>
            <label className="rc-login-field">
              <span className="rc-login-label">New password</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="rc-login-input"
              />
            </label>
            <label className="rc-login-field">
              <span className="rc-login-label">Confirm new password</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                value={newPasswordConfirm}
                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                className="rc-login-input"
              />
            </label>
          </>
        ) : null}

        {inMfaSetup ? (
          <>
            <p className="rc-login-hint">
              Account: <span className="font-mono text-[#e2ecf8]">{challengeUsername}</span>
            </p>
            {associateError ? (
              <p className="rc-login-banner-error">{associateError}</p>
            ) : totpSecret ? (
              <>
                <p className="rc-login-note">
                  Add this account in Google Authenticator, 1Password, or another TOTP app—use the button on your phone
                  or enter the secret manually.
                </p>
                {otpauthUrl ? (
                  <a
                    href={otpauthUrl}
                    className="rc-login-submit"
                    style={{ display: "block", textAlign: "center", textDecoration: "none", marginTop: 0, marginBottom: 17 }}
                  >
                    Open in authenticator app
                  </a>
                ) : null}
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
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                    className="rc-login-input"
                  />
                </label>
              </>
            ) : (
              <p className="rc-login-hint">Preparing authenticator setup…</p>
            )}
          </>
        ) : null}

        {inEmailOtp || inMfaLogin ? (
          <>
            <p className="rc-login-hint">
              Account: <span className="font-mono text-[#e2ecf8]">{challengeUsername}</span>
            </p>
            <label className="rc-login-field">
              <span className="rc-login-label">{inEmailOtp ? "Email code" : "Verification code"}</span>
              <input
                inputMode={inEmailOtp ? "text" : "numeric"}
                autoComplete="one-time-code"
                pattern={inEmailOtp ? undefined : "[0-9]*"}
                maxLength={inEmailOtp ? 32 : 12}
                required
                value={mfaLoginCode}
                onChange={(e) =>
                  setMfaLoginCode(inEmailOtp ? e.target.value.trim() : e.target.value.replace(/\D/g, ""))
                }
                className="rc-login-input"
              />
            </label>
          </>
        ) : null}

        {error ? (
          <p className="rc-login-banner-error" role="alert" aria-live="polite">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={
            submitting ||
            (inMfaSetup && (!totpSecret || !mfaAssociateSession)) ||
            ((inEmailOtp || inMfaLogin) && !mfaLoginCode.trim()) ||
            (inForgotConfirm &&
              (!forgotCode.trim() || !forgotNewPassword.trim() || !forgotNewPasswordConfirm.trim()))
          }
          className="rc-login-submit"
        >
          {submitting
            ? "Working…"
            : inNewPassword
              ? "Save password and continue"
              : inMfaSetup
                ? "Verify and continue"
                : inEmailOtp || inMfaLogin
                  ? "Verify and sign in"
                  : inForgotConfirm
                    ? "Reset password and sign in"
                    : inForgotRequest
                      ? "Send verification code"
                      : "Sign in"}
        </button>

        {activeChallenge || inForgotRequest || inForgotConfirm ? (
          <button
            type="button"
            className="rc-login-back"
            onClick={() => {
              resetChallenges();
              resetForgotPassword();
              setError(null);
            }}
          >
            Back to sign in
          </button>
        ) : null}

        {process.env.NODE_ENV !== "production" ? (
          <div className="mt-6 rounded-md border border-amber-900/40 bg-slate-950/80 p-3 font-mono text-[10px] leading-relaxed text-amber-100/90">
            <div className="font-semibold text-amber-200">Auth debug (dev only)</div>
            <div>step: {authDbg.step}</div>
            <div>session: {authDbg.sessionPresent ? "yes" : "no"}</div>
            <div>role: {authDbg.role}</div>
            <div className="break-all">target: {authDbg.redirectTarget}</div>
            <div className="break-all">last error: {authDbg.lastError}</div>
          </div>
        ) : null}

        {!activeChallenge && !inForgotRequest && !inForgotConfirm ? (
          <div className="rc-login-card__footer">
            <p className="rc-login-card__account-note">
              Need an account?{" "}
              {signupEnabled ? (
                <Link href={marketingSignupPath()}>Sign up</Link>
              ) : (
                <Link href={marketingContactPath()}>Contact your admin</Link>
              )}
            </p>
            <div className="rc-login-card__links">
              <Link href={marketingPricingPath()}>Plans</Link>
              <span className="rc-login-card__links-sep" aria-hidden>
                ·
              </span>
              <Link href={marketingHomePath()}>Home</Link>
              <span className="rc-login-card__links-sep" aria-hidden>
                ·
              </span>
              <a href={marketingRingCustomersPath()} target="_blank" rel="noopener noreferrer">
                {RING_TM} customers
              </a>
            </div>
          </div>
        ) : null}
      </form>
    </div>
  );
}
