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
  marketingSignupPath,
} from "@/lib/marketing-links";
import { postAuthRedirect } from "@/lib/auth/postAuthRedirect";
import { resolvePostLoginNavigationHref } from "@/lib/auth/post-login-redirect";
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
    (sessionUser: UserContext | null): string | null => {
      if (!sessionUser) return null;
      return resolvePostLoginNavigationHref(sessionUser, loginQuery.from, jurisdictionSlug);
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
      if (path) postAuthRedirect(router, path);
    }
  }, [isLoading, user, router, homePathFor, tryRedirectNativeDesktopOAuth]);

  useEffect(() => {
    if (!loginQuery.passwordReset) return;
    router.replace(`/${jurisdictionSlug}/login`);
  }, [jurisdictionSlug, loginQuery.passwordReset, router]);

  function navigatePostAuth(sessionUser: UserContext | null, ctx: string) {
    if (tryRedirectNativeDesktopOAuth(sessionUser)) return;
    const path = homePathFor(sessionUser);
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
    router.replace("/unauthorized?reason=session");
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
          postAuthRedirect(router, loginQuery.from);
          return;
        }
        navigatePostAuth(destinationUser, "complete_new_password");
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
      resetChallenges();
      const u4 = await refreshSessionAfterSignIn(refresh);
      if (!u4) {
        setError(
          "Signed in, but your workspace session could not be loaded. Common causes: this site’s server is still pointed at a different Cognito pool or client than your user pool, or your Cognito profile is missing required claims (for example custom:agencyId). For internal test users without billing SKUs, set custom:customerType=platform_internal.",
        );
        return;
      }
      navigatePostAuth(u4, "password_signin");
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
      <div className="w-full max-w-md rounded-lg border border-amber-900/40 bg-slate-900/60 p-6 shadow-lg lg:max-w-lg">
        <h1 className="text-lg font-semibold text-white">Sign-in is not available on this host yet</h1>
        <p className="mt-2 text-sm text-slate-400">
          Ask your deployment operator or Rapid Cortex administrator to finish secure sign-in configuration. If you need
          access or a pilot workspace, reach out and we will help route you to the correct environment.
        </p>
        <ul className="mt-4 flex flex-col gap-2 text-sm text-sky-400/90">
          <li>
            <Link href={marketingHomePath()} className="hover:text-sky-300 hover:underline">
              Home
            </Link>
          </li>
          <li>
            <Link href={marketingContactPath()} className="hover:text-sky-300 hover:underline">
              Contact us
            </Link>
          </li>
          <li>
            {signupEnabled ? (
              <Link href={marketingSignupPath()} className="hover:text-sky-300 hover:underline">
                Create account (sign up)
              </Link>
            ) : (
              "Account provisioning is staff/admin-managed."
            )}
          </li>
          <li>
            <Link href={marketingPricingPath()} className="hover:text-sky-300 hover:underline">
              Plans
            </Link>
          </li>
        </ul>
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

  return (
    <div className="w-full rounded-lg border border-slate-800/90 bg-slate-900/70 p-6 shadow-lg lg:p-7">
      <h1 className="text-lg font-semibold text-white">
        {inNewPassword
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
                    : "Sign in"}
      </h1>
      <p className="mt-1 text-sm text-slate-400">
        {inNewPassword
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
                    : "Your account is configured by your administrator with the correct organization and permissions so operational data stays aligned to your agency."}
      </p>
      {!inNewPassword && !inMfaSetup && !inMfaLogin && (justConfirmed || justVerified) ? (
        <p className="mt-3 rounded-md border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
          {justConfirmed
            ? "Email confirmed. You can sign in now."
            : "Account verified. You can sign in now."}
        </p>
      ) : null}
      {!inNewPassword && !inMfaSetup && !inMfaLogin && passwordResetNoticeVisible ? (
        <p className="mt-3 rounded-md border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
          Password reset successfully. Please sign in with your new password.
        </p>
      ) : null}
      {sessionNotice === "dashboard_required" ? (
        <p className="mt-3 rounded-md border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
          Your account does not currently have Rapid Cortex dashboard access. Contact your agency administrator or Rapid
          Cortex support.
        </p>
      ) : null}
      {sessionNotice === "rc_lite_portal" ? (
        <p className="mt-3 rounded-md border border-sky-900/50 bg-sky-950/30 px-3 py-2 text-xs text-sky-200">
          Your account has RC Lite API access. Use the RC Lite portal to manage API clients, usage, webhooks, and
          documentation.
        </p>
      ) : null}
      {sessionNotice === "no_product" ? (
        <p className="mt-3 rounded-md border border-slate-700 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
          Your account is active, but no product access has been assigned yet.
        </p>
      ) : null}
      <form className="mt-6 flex flex-col gap-4" noValidate onSubmit={onSubmit}>
        {!inNewPassword && !inMfaSetup && !inMfaLogin && !inEmailOtp && !inForgotRequest && !inForgotConfirm ? (
          <>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-300">Email</span>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-sky-500 focus:ring-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-300">Password</span>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 py-2 pl-3 pr-10 text-slate-100 outline-none ring-sky-500 focus:ring-2"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 border-0 bg-transparent p-1 text-slate-500 hover:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
                >
                  {showPassword ? <EyeOff className="h-4 w-4 shrink-0" aria-hidden /> : <Eye className="h-4 w-4 shrink-0" aria-hidden />}
                </button>
              </div>
            </label>
            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                className="text-xs text-sky-400 hover:text-sky-300 hover:underline"
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
              <p className="max-w-sm text-right text-[11px] leading-snug text-slate-500">
                Forgot password? Reset your password through secure agency sign-in.
              </p>
            </div>
          </>
        ) : null}

        {inForgotRequest ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-300">Email</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-sky-500 focus:ring-2"
            />
          </label>
        ) : null}

        {inForgotConfirm ? (
          <>
            {forgotInfoMessage ? (
              <p className="rounded-md border border-sky-900/50 bg-sky-950/30 px-3 py-2 text-xs text-sky-200">
                {forgotInfoMessage}
              </p>
            ) : null}
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-300">Email</span>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-sky-500 focus:ring-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-300">Verification code</span>
              <input
                type="text"
                autoComplete="one-time-code"
                required
                value={forgotCode}
                onChange={(e) => setForgotCode(e.target.value)}
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-sky-500 focus:ring-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-300">New password</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                value={forgotNewPassword}
                onChange={(e) => setForgotNewPassword(e.target.value)}
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-sky-500 focus:ring-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-300">Confirm new password</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                value={forgotNewPasswordConfirm}
                onChange={(e) => setForgotNewPasswordConfirm(e.target.value)}
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-sky-500 focus:ring-2"
              />
            </label>
            <p className="text-xs text-slate-500">{COGNITO_PASSWORD_REQUIREMENTS}</p>
          </>
        ) : null}

        {inNewPassword ? (
          <>
            <p className="text-xs text-slate-500">
              Account: <span className="font-mono text-slate-300">{challengeUsername}</span>
            </p>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-300">New password</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-sky-500 focus:ring-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-300">Confirm new password</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                value={newPasswordConfirm}
                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-sky-500 focus:ring-2"
              />
            </label>
          </>
        ) : null}

        {inMfaSetup ? (
          <>
            <p className="text-xs text-slate-500">
              Account: <span className="font-mono text-slate-300">{challengeUsername}</span>
            </p>
            {associateError ? (
              <p className="text-sm text-rose-400">{associateError}</p>
            ) : totpSecret ? (
              <>
                <p className="text-xs text-slate-400">
                  Add this account in Google Authenticator, 1Password, or another TOTP app—use the button on your phone or enter the secret manually.
                </p>
                {otpauthUrl ? (
                  <a
                    href={otpauthUrl}
                    className="rounded-md border border-sky-800 bg-sky-950/40 px-3 py-2 text-center text-sm font-medium text-sky-200 hover:bg-sky-900/50"
                  >
                    Open in authenticator app
                  </a>
                ) : null}
                <label className="flex flex-col gap-1 font-mono text-xs text-slate-400">
                  Secret (manual entry)
                  <input readOnly value={totpSecret} className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200" />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-300">6-digit code</span>
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={12}
                    required
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                    className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-sky-500 focus:ring-2"
                  />
                </label>
              </>
            ) : (
              <p className="text-sm text-slate-400">Preparing authenticator setup…</p>
            )}
          </>
        ) : null}

        {inEmailOtp || inMfaLogin ? (
          <>
            <p className="text-xs text-slate-500">
              Account: <span className="font-mono text-slate-300">{challengeUsername}</span>
            </p>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-300">
                {inEmailOtp ? "Email code" : "Verification code"}
              </span>
              <input
                inputMode={inEmailOtp ? "text" : "numeric"}
                autoComplete="one-time-code"
                pattern={inEmailOtp ? undefined : "[0-9]*"}
                maxLength={inEmailOtp ? 32 : 12}
                required
                value={mfaLoginCode}
                onChange={(e) =>
                  setMfaLoginCode(
                    inEmailOtp ? e.target.value.trim() : e.target.value.replace(/\D/g, ""),
                  )
                }
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-sky-500 focus:ring-2"
              />
            </label>
          </>
        ) : null}

        {error ? (
          <p className="text-sm text-rose-400" role="alert" aria-live="polite">
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
          className="rounded-md bg-sky-600 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
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
            className="text-xs text-slate-500 underline hover:text-slate-300"
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
          <p className="mt-6 text-center text-xs text-slate-500">
            Need an account?{" "}
            {signupEnabled ? (
              <>
                <Link href={marketingSignupPath()} className="text-sky-400 hover:text-sky-300">
                  Sign up
                </Link>
                {" · "}
              </>
            ) : (
              "Contact your admin · "
            )}
            <Link href={marketingPricingPath()} className="text-sky-400 hover:text-sky-300">
              Plans
            </Link>
            {" · "}
            <Link href={marketingHomePath()} className="text-sky-400 hover:text-sky-300">
              Home
            </Link>
          </p>
        ) : null}
      </form>
    </div>
  );
}
