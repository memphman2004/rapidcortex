"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SiteLogoMark } from "@/components/brand/site-logo-link";
import { marketingHomePath } from "@/lib/marketing-links";
import {
  buildNativeDesktopCognitoAuthorizeUrl,
  clearNativeDesktopOAuthPkce,
  readNativeDesktopOAuthPkce,
} from "@/lib/auth/native-desktop-oauth";
import { isAllowedNativeAppCallbackUri } from "@/lib/auth/nativeAuthConfig";

const DEFAULT_SCHEME = "rapidcortex://oauth/callback";

/** After branded `/login` + `prompt=none`, Cognito may bounce here before a Hosted UI SSO cookie exists. */
const SILENT_AUTH_RECOVERY_ERRORS = new Set(["login_required", "interaction_required", "consent_required"]);

function buildDeepLink(code: string, state: string, baseCallback: string): string {
  const u = new URL(baseCallback);
  u.searchParams.set("code", code);
  u.searchParams.set("state", state);
  return u.toString();
}

export function ReturnToAppContent() {
  const search = useSearchParams();
  const code = search.get("code")?.trim() ?? "";
  const state = search.get("state")?.trim() ?? "";
  const oauthError = search.get("error")?.trim();
  const oauthDesc = search.get("error_description")?.trim();

  let deepLink = "";
  if (code && state) {
    const bundle = readNativeDesktopOAuthPkce();
    const raw = bundle?.appCallbackUri?.trim();
    const base = raw && isAllowedNativeAppCallbackUri(raw) ? raw : DEFAULT_SCHEME;
    try {
      deepLink = buildDeepLink(code, state, base);
    } catch {
      deepLink = buildDeepLink(code, state, DEFAULT_SCHEME);
    }
  }

  const [autoTried, setAutoTried] = useState(false);
  const [silentRecoveryFailed, setSilentRecoveryFailed] = useState(false);

  useEffect(() => {
    if (!oauthError || !SILENT_AUTH_RECOVERY_ERRORS.has(oauthError)) return;
    const bundle = readNativeDesktopOAuthPkce();
    if (bundle) {
      try {
        window.location.replace(buildNativeDesktopCognitoAuthorizeUrl(bundle));
      } catch {
        setSilentRecoveryFailed(true);
      }
      return;
    }
    const t = window.setTimeout(() => setSilentRecoveryFailed(true), 2800);
    return () => window.clearTimeout(t);
  }, [oauthError]);

  useEffect(() => {
    if (code && state) clearNativeDesktopOAuthPkce();
  }, [code, state]);

  useEffect(() => {
    if (!deepLink || oauthError) return;
    const t = window.setTimeout(() => {
      setAutoTried(true);
      window.location.href = deepLink;
    }, 600);
    return () => window.clearTimeout(t);
  }, [deepLink, oauthError]);

  if (oauthError) {
    if (SILENT_AUTH_RECOVERY_ERRORS.has(oauthError) && !silentRecoveryFailed) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center text-slate-200">
          <SiteLogoMark heightClass="h-16" />
          <h1 className="mt-8 text-xl font-semibold text-white">Continuing sign-in…</h1>
          <p className="mt-3 max-w-md text-sm text-slate-400">
            Finishing authorization for the desktop app. If nothing happens, close this tab and start again from Rapid
            Cortex.
          </p>
        </div>
      );
    }
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center text-slate-200">
        <SiteLogoMark heightClass="h-16" />
        <h1 className="mt-8 text-xl font-semibold text-white">Sign-in could not complete</h1>
        <p className="mt-3 max-w-md text-sm text-slate-400">{oauthDesc || oauthError}</p>
        <Link href={marketingHomePath()} className="mt-8 text-sm text-sky-400 hover:text-sky-300">
          Return to home
        </Link>
      </div>
    );
  }

  if (!code || !state) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center text-slate-200">
        <SiteLogoMark heightClass="h-16" />
        <h1 className="mt-8 text-xl font-semibold text-white">Missing sign-in parameters</h1>
        <p className="mt-3 max-w-md text-sm text-slate-400">
          This page should only open after Cognito redirects back with an authorization code. Close this tab and start
          sign-in from the Rapid Cortex app again.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center text-slate-200">
      <SiteLogoMark heightClass="h-20" priority />
      <h1 className="mt-10 text-2xl font-semibold text-white">Rapid Cortex</h1>
      <p className="mt-4 max-w-lg text-base text-slate-300">
        You are signed in. Return to Rapid Cortex to continue.
      </p>
      {autoTried ? (
        <p className="mt-2 text-xs text-slate-500">Attempted to open the app automatically…</p>
      ) : null}
      <a
        href={deepLink}
        className="mt-10 inline-flex min-w-[220px] items-center justify-center rounded-lg bg-sky-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-sky-500"
      >
        Open Rapid Cortex
      </a>
      <p className="mt-8 max-w-lg text-xs leading-relaxed text-slate-500">
        If the app does not open automatically, click the button above. If you do not have Rapid Cortex installed,
        contact your agency administrator.
      </p>
    </div>
  );
}
