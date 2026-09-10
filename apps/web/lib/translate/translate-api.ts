import type {
  TranslateLinkRequest,
  TranslateLinkResponse,
  TranslatePhrase,
  TranslateSegment,
  TranslateSession,
  TranslateSessionCloseRequest,
  TranslateSessionCloseResponse,
  TranslateSessionCreateRequest,
  TranslateSessionCreateResponse,
  TranslateVertical,
  SupportedLanguage,
} from "rapid-cortex-shared";

class TranslateApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "TranslateApiError";
    this.status = status;
  }
}

async function translateRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { error: text };
  }
  if (!res.ok) {
    const err = body as { error?: string };
    throw new TranslateApiError(err.error ?? `Translate request failed (${res.status})`, res.status);
  }
  return body as T;
}

export function createTranslateSession(body: TranslateSessionCreateRequest) {
  return translateRequest<TranslateSessionCreateResponse>("/api/translate/sessions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listTranslateSessions(opts?: { status?: string; vertical?: TranslateVertical }) {
  const q = new URLSearchParams();
  if (opts?.status) q.set("status", opts.status);
  if (opts?.vertical) q.set("vertical", opts.vertical);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return translateRequest<{ items: TranslateSession[]; count: number }>(`/api/translate/sessions${suffix}`);
}

export function getTranslateSession(sessionId: string) {
  return translateRequest<{ session: TranslateSession }>(
    `/api/translate/sessions/${encodeURIComponent(sessionId)}`,
  );
}

export function listTranslateSegments(sessionId: string) {
  return translateRequest<{ items: TranslateSegment[] }>(
    `/api/translate/sessions/${encodeURIComponent(sessionId)}/segments`,
  );
}

export function closeTranslateSession(sessionId: string, body: TranslateSessionCloseRequest = {}) {
  return translateRequest<TranslateSessionCloseResponse>(
    `/api/translate/sessions/${encodeURIComponent(sessionId)}/close`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function joinTranslateMonitor(sessionId: string) {
  return translateRequest<{ session: TranslateSession; wsEndpoint: string }>(
    `/api/translate/sessions/${encodeURIComponent(sessionId)}/monitor`,
    { method: "POST", body: "{}" },
  );
}

export function getTranslateWsToken(sessionId: string, role: "officer" | "monitor" = "officer") {
  return translateRequest<{ token: string; wsEndpoint: string; expiresIn: number }>(
    `/api/translate/sessions/${encodeURIComponent(sessionId)}/ws-token?role=${role}`,
  );
}

export function sendTranslateLink(body: TranslateLinkRequest) {
  return translateRequest<TranslateLinkResponse>("/api/translate/link", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getTranslateLanguages() {
  return translateRequest<{ officer: SupportedLanguage; languages: SupportedLanguage[] }>(
    "/api/translate/languages",
  );
}

export function getTranslatePhrases(vertical: TranslateVertical) {
  return translateRequest<{ phrases: TranslatePhrase[] }>(
    `/api/translate/phrases?vertical=${encodeURIComponent(vertical)}`,
  );
}

export { TranslateApiError };
