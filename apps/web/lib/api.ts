import type { TranscriptConnectorResolution } from "rapid-cortex-integrations";
import { isSam3ApiPath, isSam4ApiPath, isStack2ApiPath } from "@/lib/comms-api-path";
import type {
  ActiveCallRecord,
  ActiveCallsListResponse,
  AddPaymentMethodInput,
  AgencyBillingProfile,
  AgencyTenant,
  AIAnalysis,
  AuditEvent,
  CancelSubscriptionInput,
  ChangeSubscriptionPlanInput,
  CreateAgencyInput,
  CreateInvoiceInput,
  CreateInviteInput,
  CreateQAProtocolTemplateInput,
  CreateQASessionInput,
  RequestIncidentMediaInput,
  Incident,
  IncidentMediaListItem,
  InviteRecord,
  InvoiceRecord,
  PatchAgencyBillingProfileInput,
  PatchAgencyInput,
  PatchIncidentDispatcherBody,
  PatchQAProtocolTemplateInput,
  PatchQASessionInput,
  PaymentMethod,
  QAProtocolTemplate,
  QASession,
  SetDefaultPaymentMethodInput,
  SubscriptionPlanDefinition,
  TranscriptSegment,
  TakeoverCallBody,
  TransferCallBody,
  TransferCallResponse,
  UserContext,
  UserRole,
  CallIdBody,
  CreateSilentTextSessionBody,
  CreateVideoAssistSessionBody,
  SilentTextDispatcherSession,
  VideoAssistDispatcherSession,
  RequestLiveVideoPayload,
  JoinLiveVideoResponse,
  LiveHeartbeatPayload,
  TriageResult,
  TraumaFlagRecord,
  CallerCardResponse,
  CreatePremiseNoteRequest,
  CreatePremiseNoteResponse,
  PatchPremiseNoteRequest,
  PatchPremiseNoteResponse,
  SupervisorPerformanceMetricsResponse,
  DispatcherPerformanceDetailResponse,
  PostDispatcherCoachingNoteBody,
  IncidentShareRecord,
  GetLiveSessionResponse,
  RecordedPlaybackResponse,
  DesktopPlatform,
  DesktopReleasesOverviewResponse,
  DesktopSignedUrlResponse,
  CadWritebackAuditRecord,
  AddonDefinition,
  BillingAuditEventRecord,
  PatchTenantAddonBody,
  TenantEntitlements,
} from "rapid-cortex-shared";

function normalizeApiOrigin(raw: string | undefined): string {
  const s = raw?.trim();
  return s ? s.replace(/\/$/, "") : "";
}

/** Prefer NEXT_PUBLIC_API_BASE (browser bundle naming); Dockerfile/CodeBuild often only set NEXT_PUBLIC_API_BASE_URL. */
const DIRECT_API_BASE =
  typeof process !== "undefined"
    ? normalizeApiOrigin(process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL)
    : "";

const DIRECT_API_BASE_2 =
  typeof process !== "undefined"
    ? normalizeApiOrigin(process.env.NEXT_PUBLIC_API_BASE_2)
    : "";

const DIRECT_API_BASE_3 =
  typeof process !== "undefined"
    ? normalizeApiOrigin(process.env.NEXT_PUBLIC_API_BASE_3)
    : "";

const DIRECT_API_BASE_4 =
  typeof process !== "undefined"
    ? normalizeApiOrigin(process.env.NEXT_PUBLIC_API_BASE_4)
    : "";

const USE_AUTH_PROXY =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_AUTH_PROXY === "1";

function firstNonEmpty(...candidates: Array<string | undefined>): string {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) return trimmed.replace(/\/$/, "");
  }
  return "";
}

/** Browser always uses the cookie-backed BFF; server uses upstream env or direct bases. */
function shouldUseSameOriginBff(): boolean {
  if (USE_AUTH_PROXY) return true;
  if (typeof window !== "undefined") return true;
  if (DIRECT_API_BASE.length === 0 && DIRECT_API_BASE_2.length === 0 && DIRECT_API_BASE_3.length === 0 && DIRECT_API_BASE_4.length === 0) {
    return Boolean(
      firstNonEmpty(
        process.env.API_UPSTREAM_BASE,
        process.env.API_UPSTREAM_BASE_2,
        process.env.API_UPSTREAM_BASE_3,
        process.env.API_UPSTREAM_BASE_4,
      ),
    );
  }
  return false;
}

function usesCookieBackedBff(): boolean {
  return shouldUseSameOriginBff() && (USE_AUTH_PROXY || typeof window !== "undefined");
}

function resolveApiBase(): string {
  if (shouldUseSameOriginBff()) {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/api/backend`;
    }
    const upstream = firstNonEmpty(process.env.API_UPSTREAM_BASE);
    if (upstream) return upstream;
    const site = firstNonEmpty(process.env.NEXT_PUBLIC_SITE_URL);
    if (site) return `${site}/api/backend`;
    return "http://127.0.0.1:3000/api/backend";
  }
  return DIRECT_API_BASE;
}

function resolveApiBaseForPath(apiPath: string): string {
  if (shouldUseSameOriginBff()) {
    if (typeof window !== "undefined") {
      return resolveApiBase();
    }
    if (isSam4ApiPath(apiPath)) {
      return firstNonEmpty(process.env.API_UPSTREAM_BASE_4, DIRECT_API_BASE_4);
    }
    if (isSam3ApiPath(apiPath)) {
      return firstNonEmpty(process.env.API_UPSTREAM_BASE_3, DIRECT_API_BASE_3);
    }
    if (isStack2ApiPath(apiPath)) {
      return firstNonEmpty(process.env.API_UPSTREAM_BASE_2, DIRECT_API_BASE_2);
    }
    return resolveApiBase();
  }
  if (DIRECT_API_BASE_4 && isSam4ApiPath(apiPath)) {
    return DIRECT_API_BASE_4;
  }
  if (DIRECT_API_BASE_3 && isSam3ApiPath(apiPath)) {
    return DIRECT_API_BASE_3;
  }
  if (DIRECT_API_BASE_2 && isStack2ApiPath(apiPath)) {
    return DIRECT_API_BASE_2;
  }
  return DIRECT_API_BASE;
}

const jsonHeaders: HeadersInit = {
  "Content-Type": "application/json",
};

/**
 * True when the web app can reach the API (direct public bases, auth proxy flag, same-origin BFF, or server upstream).
 */
export function isApiConfigured(): boolean {
  if (USE_AUTH_PROXY) return true;
  if (DIRECT_API_BASE.length > 0 || DIRECT_API_BASE_2.length > 0 || DIRECT_API_BASE_3.length > 0 || DIRECT_API_BASE_4.length > 0) return true;
  if (typeof window !== "undefined") return true;
  return Boolean(
    firstNonEmpty(
      process.env.API_UPSTREAM_BASE,
      process.env.API_UPSTREAM_BASE_2,
      process.env.API_UPSTREAM_BASE_3,
      process.env.API_UPSTREAM_BASE_4,
    ),
  );
}

function formatJsonErrorMessage(body: unknown, status: number): string {
  if (!body || typeof body !== "object") {
    return `Request failed ${status}`;
  }
  const o = body as Record<string, unknown>;
  const err = typeof o.error === "string" ? o.error : null;
  const message = typeof o.message === "string" ? o.message : null;
  const requestId = typeof o.requestId === "string" ? o.requestId : null;
  const errorCode = typeof o.errorCode === "string" ? o.errorCode : null;
  const base = err ?? message ?? `Request failed ${status}`;
  const parts: string[] = [base];
  if (errorCode) parts.push(`code: ${errorCode}`);
  if (requestId) parts.push(`requestId: ${requestId}`);
  return parts.join(" · ");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const API_BASE = resolveApiBaseForPath(path);
  if (!API_BASE) {
    throw new Error("API base URL not configured");
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: usesCookieBackedBff() ? "include" : (init?.credentials ?? "same-origin"),
    headers: { ...jsonHeaders, ...init?.headers },
  });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    throw new Error(formatJsonErrorMessage(body, res.status));
  }
  return body as T;
}

export async function fetchIncidents(): Promise<Incident[]> {
  const data = await request<{ items: Incident[] }>("/api/incidents");
  return data.items;
}

export async function fetchIncident(id: string): Promise<Incident> {
  return request<Incident>(`/api/incidents/${id}`);
}

export async function patchIncidentDispatch(
  incidentId: string,
  body: PatchIncidentDispatcherBody,
): Promise<Incident> {
  return request<Incident>(`/api/incidents/${encodeURIComponent(incidentId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function fetchTranscript(
  incidentId: string,
): Promise<TranscriptSegment[]> {
  const data = await request<{ items?: TranscriptSegment[] }>(
    `/api/incidents/${incidentId}/transcript`,
  );
  return data.items ?? [];
}

/** Backend exposes GET .../analysis — returns newest-first list */
export async function fetchAnalyses(
  incidentId: string,
): Promise<AIAnalysis[]> {
  const data = await request<{ items: AIAnalysis[] }>(
    `/api/incidents/${incidentId}/analysis`,
  );
  return data.items;
}

export async function postTranscriptSegment(
  incidentId: string,
  segment: Pick<TranscriptSegment, "speaker" | "text" | "timestamp">,
): Promise<TranscriptSegment> {
  return request<TranscriptSegment>(`/api/incidents/${incidentId}/transcript`, {
    method: "POST",
    body: JSON.stringify(segment),
  });
}

export type AnalyzeIncidentErrorBody = {
  success?: boolean;
  analysisStatus?: string;
  errorCode?: string;
  message?: string;
  requestId?: string;
};

export class AnalyzeIncidentError extends Error {
  readonly status: number;
  readonly body: AnalyzeIncidentErrorBody;

  constructor(status: number, body: AnalyzeIncidentErrorBody) {
    super(body.message ?? `Analyze failed (${status})`);
    this.name = "AnalyzeIncidentError";
    this.status = status;
    this.body = body;
  }
}

export async function postAnalyze(incidentId: string): Promise<AIAnalysis> {
  const API_BASE = resolveApiBase();
  if (!API_BASE) {
    throw new Error("API base URL not configured");
  }
  const res = await fetch(`${API_BASE}/api/incidents/${incidentId}/analyze`, {
    method: "POST",
    credentials: USE_AUTH_PROXY ? "include" : "same-origin",
    headers: jsonHeaders,
    body: JSON.stringify({}),
  });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const parsed = body as AnalyzeIncidentErrorBody | { error?: string } | null;
    if (parsed && typeof parsed === "object") {
      if ("errorCode" in parsed && parsed.errorCode) {
        throw new AnalyzeIncidentError(res.status, parsed as AnalyzeIncidentErrorBody);
      }
      if (
        "success" in parsed &&
        parsed.success === false &&
        typeof parsed.message === "string" &&
        parsed.message.length > 0
      ) {
        throw new AnalyzeIncidentError(res.status, {
          success: false,
          analysisStatus: parsed.analysisStatus,
          errorCode: parsed.errorCode,
          message: parsed.message,
          requestId: parsed.requestId,
        });
      }
    }
    throw new Error(formatJsonErrorMessage(body, res.status));
  }
  return body as AIAnalysis;
}

export type DemoScenarioRow = {
  id: string;
  name: string;
  category: string;
  valuePitch?: string;
};

export async function fetchDemoScenarios(): Promise<DemoScenarioRow[]> {
  const data = await request<{ items: DemoScenarioRow[] }>("/api/demo/scenarios");
  return data.items;
}

export async function postDemoStart(scenarioId: string): Promise<unknown> {
  return request("/api/demo/start", {
    method: "POST",
    body: JSON.stringify({ scenarioId }),
  });
}

export type IntegrationStatusPayload = {
  agencyId: string;
  transcriptSource: TranscriptConnectorResolution;
  auditHint: string;
  deploymentStage?: string;
  pilotReadiness?: {
    languageSessionsConfigured: boolean;
    multilingualStrictValidation: boolean;
    multilingualIssueCount: number;
    multilingualPrimaryStt: string;
    multilingualPrimaryTranslation: string;
    multilingualPrimaryLanguageDetector: string;
    aiPrimaryProvider: string;
    aiSecondaryProvider: string;
    aiTertiaryProvider: string;
    assetsBucketConfigured: boolean;
  };
};

export async function fetchIntegrationStatus(): Promise<IntegrationStatusPayload> {
  return request("/api/integration/status");
}

/** RC Admin — cross-tenant command center (GET /api/platform/summary). */
export type PlatformSummaryPayload = {
  generatedAt: string;
  totals: {
    agencies: number;
    activeAgencies: number;
    users: number;
    activeUsers: number;
    liveIncidents: number;
    onboardingItemsNeedingAttention: number;
    agenciesWithOnboardingBlockers: number;
    pilotOrDraftAgencies: number;
  };
  integrationSnapshot: IntegrationStatusPayload;
  hasAgencies: boolean;
};

export async function fetchPlatformSummary(): Promise<PlatformSummaryPayload> {
  return request<PlatformSummaryPayload>("/api/platform/summary");
}

export type FetchPlatformAuditParams = {
  limit?: number;
  perAgencyCap?: number;
  agencyId?: string;
  type?: string;
  from?: string;
  to?: string;
};

/** RC Admin — merged audit across tenants. */
export async function fetchPlatformAuditEvents(
  params: FetchPlatformAuditParams = {},
): Promise<AuditEvent[]> {
  const sp = new URLSearchParams();
  if (params.limit != null) sp.set("limit", String(params.limit));
  if (params.perAgencyCap != null) sp.set("perAgencyCap", String(params.perAgencyCap));
  if (params.agencyId) sp.set("agencyId", params.agencyId);
  if (params.type) sp.set("type", params.type);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  const q = sp.toString();
  const data = await request<{ items: AuditEvent[] }>(
    `/api/platform/audit-events${q ? `?${q}` : ""}`,
  );
  return data.items;
}

export type ApiHealthPayload = {
  status: string;
  service: string;
  deploymentStage?: string;
  revision?: string;
};

export async function fetchApiHealth(): Promise<ApiHealthPayload> {
  /**
   * Must hit the Next route handler (`app/api/health/upstream`), not the auth BFF.
   * `request()` prefixes `/api/backend`, which would call API Gateway `/api/health/upstream` (404).
   */
  const res = await fetch("/api/health/upstream", {
    cache: "no-store",
    credentials: "include",
  });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    throw new Error(formatJsonErrorMessage(body, res.status));
  }
  return body as ApiHealthPayload;
}

export async function fetchAuditEvents(limit = 50): Promise<AuditEvent[]> {
  const data = await request<{ items: AuditEvent[] }>(
    `/api/audit/events?limit=${encodeURIComponent(String(limit))}`,
  );
  return data.items;
}

export async function fetchMe(): Promise<{ user: UserContext; principalKind: string }> {
  return request("/api/me");
}

export async function fetchAgencies(): Promise<AgencyTenant[]> {
  const data = await request<{ items: AgencyTenant[] }>("/api/agencies");
  return data.items;
}

export async function postAgency(body: CreateAgencyInput): Promise<AgencyTenant> {
  return request<AgencyTenant>("/api/agencies", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchAgency(agencyId: string): Promise<AgencyTenant> {
  return request<AgencyTenant>(`/api/agencies/${encodeURIComponent(agencyId)}`);
}

export async function patchAgency(
  agencyId: string,
  body: PatchAgencyInput,
): Promise<AgencyTenant> {
  return request<AgencyTenant>(`/api/agencies/${encodeURIComponent(agencyId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function fetchAgencyInvites(agencyId: string): Promise<InviteRecord[]> {
  const data = await request<{ items: InviteRecord[] }>(
    `/api/agencies/${encodeURIComponent(agencyId)}/invites`,
  );
  return data.items;
}

export async function postAgencyInvite(
  agencyId: string,
  body: CreateInviteInput,
): Promise<InviteRecord> {
  return request<InviteRecord>(`/api/agencies/${encodeURIComponent(agencyId)}/invites`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchBillingPlans(): Promise<SubscriptionPlanDefinition[]> {
  const data = await request<{ items: SubscriptionPlanDefinition[] }>("/api/billing/plans");
  return data.items;
}

export async function fetchAgencyBillingProfile(agencyId: string): Promise<AgencyBillingProfile> {
  return request<AgencyBillingProfile>(
    `/api/agencies/${encodeURIComponent(agencyId)}/billing-profile`,
  );
}

export async function patchAgencyBillingProfile(
  agencyId: string,
  body: PatchAgencyBillingProfileInput,
): Promise<AgencyBillingProfile> {
  return request<AgencyBillingProfile>(
    `/api/agencies/${encodeURIComponent(agencyId)}/billing-profile`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export async function postBillingSubscriptionChange(
  agencyId: string,
  body: ChangeSubscriptionPlanInput,
): Promise<AgencyBillingProfile> {
  return request<AgencyBillingProfile>(
    `/api/agencies/${encodeURIComponent(agencyId)}/billing/subscription/change`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function postBillingSubscriptionCancel(
  agencyId: string,
  body: CancelSubscriptionInput,
): Promise<AgencyBillingProfile> {
  return request<AgencyBillingProfile>(
    `/api/agencies/${encodeURIComponent(agencyId)}/billing/subscription/cancel`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function fetchAgencyBillingInvoices(agencyId: string): Promise<InvoiceRecord[]> {
  const data = await request<{ items: InvoiceRecord[] }>(
    `/api/agencies/${encodeURIComponent(agencyId)}/billing/invoices`,
  );
  return data.items;
}

export async function postAgencyBillingInvoice(
  agencyId: string,
  body: CreateInvoiceInput,
): Promise<AgencyBillingProfile> {
  return request<AgencyBillingProfile>(
    `/api/agencies/${encodeURIComponent(agencyId)}/billing/invoices`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function fetchAgencyBillingPaymentMethods(agencyId: string): Promise<PaymentMethod[]> {
  const data = await request<{ items: PaymentMethod[] }>(
    `/api/agencies/${encodeURIComponent(agencyId)}/billing/payment-methods`,
  );
  return data.items;
}

export type MonetizationSubscriptionSnapshot = {
  agencyId: string;
  planId?: string;
  addOnIds?: string[];
  billingStatus?: string;
  subscriptionStatus?: string;
  externalBillingCustomerId?: string;
  externalBillingSubscriptionId?: string;
  paymentMethod?: string;
};

export async function fetchMonetizationSubscription(
  agencyId: string,
): Promise<MonetizationSubscriptionSnapshot | null> {
  try {
    return await request<MonetizationSubscriptionSnapshot>(
      `/api/billing/current-subscription?agencyId=${encodeURIComponent(agencyId)}`,
    );
  } catch {
    return null;
  }
}

export async function postAgencyBillingPaymentMethod(
  agencyId: string,
  body: AddPaymentMethodInput,
): Promise<AgencyBillingProfile> {
  return request<AgencyBillingProfile>(
    `/api/agencies/${encodeURIComponent(agencyId)}/billing/payment-methods`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function postAgencyBillingPaymentMethodDefault(
  agencyId: string,
  body: SetDefaultPaymentMethodInput,
): Promise<AgencyBillingProfile> {
  return request<AgencyBillingProfile>(
    `/api/agencies/${encodeURIComponent(agencyId)}/billing/payment-methods/default`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export type AdminUserRow = {
  username: string;
  email: string;
  agencyId: string;
  role: UserRole;
  enabled: boolean;
  status: string;
};

export async function fetchAdminUsers(): Promise<AdminUserRow[]> {
  const data = await request<{ items: AdminUserRow[] }>("/api/admin/users");
  return data.items;
}

/** Agency admin platform — access override rows (Lambda + DynamoDB). */
export type AccessOverrideRecordApi = {
  overrideId: string;
  agencyId: string;
  targetUserKey: string;
  targetUserId: string;
  targetUserEmail: string;
  targetUserName: string;
  grantedRoleOrPermission: string;
  overrideType: "role" | "permission" | "feature" | "incident-access";
  reason: string;
  status: "active" | "revoked" | "expired";
  grantedByUserId: string;
  grantedByName: string;
  grantedAt: string;
  expiresAt?: string | null;
  revokedByUserId?: string | null;
  revokedAt?: string | null;
  revokeReason?: string | null;
  createdAt: string;
  updatedAt: string;
  effectiveStatus?: "active" | "revoked" | "expired";
};

export async function fetchAgencyAdminAccessOverridesList(params?: {
  agencyId?: string;
  status?: string;
  search?: string;
}): Promise<{ items: AccessOverrideRecordApi[] }> {
  const sp = new URLSearchParams();
  if (params?.agencyId) sp.set("agencyId", params.agencyId);
  if (params?.status) sp.set("status", params.status);
  if (params?.search) sp.set("search", params.search);
  const q = sp.toString();
  return request(`/api/agency-admin/overrides${q ? `?${q}` : ""}`);
}

export async function fetchAgencyAdminAccessOverride(params: {
  overrideId: string;
  agencyId?: string;
}): Promise<AccessOverrideRecordApi> {
  const sp = new URLSearchParams();
  if (params.agencyId) sp.set("agencyId", params.agencyId);
  const q = sp.toString();
  return request(
    `/api/agency-admin/overrides/${encodeURIComponent(params.overrideId)}${q ? `?${q}` : ""}`,
  );
}

export async function fetchAgencyAdminUserAccessOverrides(params: {
  userId: string;
  agencyId?: string;
}): Promise<{ items: AccessOverrideRecordApi[] }> {
  const sp = new URLSearchParams();
  if (params.agencyId) sp.set("agencyId", params.agencyId);
  const q = sp.toString();
  return request(
    `/api/agency-admin/users/${encodeURIComponent(params.userId)}/overrides${q ? `?${q}` : ""}`,
  );
}

export async function postAgencyAdminAccessOverride(body: {
  targetUserId: string;
  overrideType: AccessOverrideRecordApi["overrideType"];
  grantedRoleOrPermission: string;
  reason: string;
  expiresAt?: string | null;
  agencyId?: string;
}): Promise<AccessOverrideRecordApi> {
  return request(`/api/agency-admin/overrides`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function patchAgencyAdminAccessOverrideRevoke(params: {
  overrideId: string;
  reason: string;
  agencyId?: string;
}): Promise<AccessOverrideRecordApi> {
  const sp = new URLSearchParams();
  if (params.agencyId) sp.set("agencyId", params.agencyId);
  const q = sp.toString();
  return request(
    `/api/agency-admin/overrides/${encodeURIComponent(params.overrideId)}/revoke${q ? `?${q}` : ""}`,
    {
      method: "PATCH",
      body: JSON.stringify({ reason: params.reason }),
    },
  );
}

export async function postAdminCreateUser(body: {
  email: string;
  agencyId: string;
  role: UserRole;
  temporaryPassword: string;
}): Promise<AdminUserRow> {
  return request<AdminUserRow>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function patchAdminUser(body: {
  username: string;
  agencyId?: string;
  role?: UserRole;
  passwordChangeRequired?: boolean;
}): Promise<void> {
  await request<{ ok: boolean }>("/api/admin/users", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function postAdminDeactivateUser(username: string): Promise<void> {
  await request<{ ok: boolean }>("/api/admin/users/deactivate", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

export async function postAdminActivateUser(username: string): Promise<void> {
  await request<{ ok: boolean }>("/api/admin/users/activate", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

export type VideoAssistSessionBrief = {
  sessionId: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  smsSentAt?: string | null;
};

export async function fetchVideoAssistSessions(incidentId: string): Promise<VideoAssistSessionBrief[]> {
  const data = await request<{ items: VideoAssistSessionBrief[] }>(
    `/api/incidents/${encodeURIComponent(incidentId)}/video-assist/sessions`,
  );
  return data.items;
}

export async function postVideoAssistSession(
  incidentId: string,
  body: CreateVideoAssistSessionBody,
): Promise<{ session: VideoAssistDispatcherSession; token: string; publicUrl: string }> {
  return request(`/api/incidents/${encodeURIComponent(incidentId)}/video-assist/sessions`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchVideoAssistSession(
  incidentId: string,
  sessionId: string,
): Promise<VideoAssistDispatcherSession> {
  return request(
    `/api/incidents/${encodeURIComponent(incidentId)}/video-assist/sessions/${encodeURIComponent(sessionId)}`,
  );
}

export async function postVideoAssistResend(incidentId: string, sessionId: string): Promise<VideoAssistDispatcherSession> {
  return request(
    `/api/incidents/${encodeURIComponent(incidentId)}/video-assist/sessions/${encodeURIComponent(sessionId)}/resend`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export async function postVideoAssistCancel(
  incidentId: string,
  sessionId: string,
): Promise<VideoAssistDispatcherSession> {
  return request(
    `/api/incidents/${encodeURIComponent(incidentId)}/video-assist/sessions/${encodeURIComponent(sessionId)}/cancel`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export async function postVideoAssistDispatcherSignal(
  incidentId: string,
  sessionId: string,
  body: unknown,
): Promise<VideoAssistDispatcherSession> {
  return request(
    `/api/incidents/${encodeURIComponent(incidentId)}/video-assist/sessions/${encodeURIComponent(sessionId)}/signal`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function postVideoAssistMarkLive(
  incidentId: string,
  sessionId: string,
): Promise<VideoAssistDispatcherSession> {
  return request(
    `/api/incidents/${encodeURIComponent(incidentId)}/video-assist/sessions/${encodeURIComponent(sessionId)}/live`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export type LiveVideoSessionView = GetLiveSessionResponse;

export async function postLiveVideoRequest(
  incidentId: string,
  body: RequestLiveVideoPayload,
): Promise<{
  sessionId: string;
  status: "pending" | "active" | "ended" | "expired" | "failed";
  expiresAt: string;
  maskedRecipient: string;
  provider: string;
  liveVideoPipeline?: "aws_kinesis_webrtc" | "legacy_p2p";
}> {
  return request(`/api/incidents/${encodeURIComponent(incidentId)}/live-video/request`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchLiveVideoSession(incidentId: string): Promise<LiveVideoSessionView> {
  return request(`/api/incidents/${encodeURIComponent(incidentId)}/live-video`);
}

/** Same join bundle as GET — explicit POST for clients that prefer a join verb. */
export async function postLiveVideoJoin(incidentId: string): Promise<LiveVideoSessionView> {
  return request(`/api/incidents/${encodeURIComponent(incidentId)}/live-video/join`, { method: "POST" });
}

export async function fetchLiveVideoPlayback(incidentId: string): Promise<RecordedPlaybackResponse> {
  return request(`/api/incidents/${encodeURIComponent(incidentId)}/live-video/playback`);
}

export async function postLiveVideoEnd(
  incidentId: string,
  body: { sessionId?: string; reason?: "manual" | "timeout" | "incident_closed" | "disconnect" | "error" } = {},
): Promise<JoinLiveVideoResponse> {
  return request(`/api/incidents/${encodeURIComponent(incidentId)}/live-video/end`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function postLiveVideoDispatcherHeartbeat(
  incidentId: string,
  body: LiveHeartbeatPayload,
): Promise<JoinLiveVideoResponse> {
  return request(`/api/incidents/${encodeURIComponent(incidentId)}/live-video/heartbeat`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type SilentTextSessionBrief = {
  sessionId: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  smsSentAt?: string | null;
  highRisk?: boolean;
};

export async function fetchSilentTextSessions(incidentId: string): Promise<SilentTextSessionBrief[]> {
  const data = await request<{ items: SilentTextSessionBrief[] }>(
    `/api/incidents/${encodeURIComponent(incidentId)}/silent-text/sessions`,
  );
  return data.items;
}

export async function postSilentTextSession(
  incidentId: string,
  body: CreateSilentTextSessionBody,
): Promise<{ session: SilentTextDispatcherSession; token: string; publicUrl: string }> {
  return request(`/api/incidents/${encodeURIComponent(incidentId)}/silent-text/sessions`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchSilentTextSession(
  incidentId: string,
  sessionId: string,
): Promise<SilentTextDispatcherSession> {
  return request(
    `/api/incidents/${encodeURIComponent(incidentId)}/silent-text/sessions/${encodeURIComponent(sessionId)}`,
  );
}

export async function postSilentTextResend(incidentId: string, sessionId: string): Promise<SilentTextDispatcherSession> {
  return request(
    `/api/incidents/${encodeURIComponent(incidentId)}/silent-text/sessions/${encodeURIComponent(sessionId)}/resend`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export async function postSilentTextCancel(
  incidentId: string,
  sessionId: string,
): Promise<SilentTextDispatcherSession> {
  return request(
    `/api/incidents/${encodeURIComponent(incidentId)}/silent-text/sessions/${encodeURIComponent(sessionId)}/cancel`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export async function postSilentTextClose(
  incidentId: string,
  sessionId: string,
): Promise<SilentTextDispatcherSession> {
  return request(
    `/api/incidents/${encodeURIComponent(incidentId)}/silent-text/sessions/${encodeURIComponent(sessionId)}/close`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export async function postSilentTextDispatcherMessage(
  incidentId: string,
  sessionId: string,
  body: { text: string; promptTemplateId?: string },
): Promise<SilentTextDispatcherSession> {
  return request(
    `/api/incidents/${encodeURIComponent(incidentId)}/silent-text/sessions/${encodeURIComponent(sessionId)}/message`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function postSilentTextHighRisk(
  incidentId: string,
  sessionId: string,
): Promise<SilentTextDispatcherSession> {
  return request(
    `/api/incidents/${encodeURIComponent(incidentId)}/silent-text/sessions/${encodeURIComponent(sessionId)}/high-risk`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export type PinpointLinkBrief = {
  linkId: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  smsSentAt?: string | null;
  lastPingAt?: string | null;
};

export async function fetchPinpointLinks(incidentId: string): Promise<PinpointLinkBrief[]> {
  const data = await request<{ items: PinpointLinkBrief[] }>(
    `/api/incidents/${encodeURIComponent(incidentId)}/pinpoint/links`,
  );
  return data.items;
}

export async function postPinpointLink(
  incidentId: string,
  body: { callerPhoneE164: string; publicAppBaseUrl?: string },
): Promise<{ linkId: string; token: string; publicUrl: string }> {
  return request(`/api/incidents/${encodeURIComponent(incidentId)}/pinpoint/links`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function postPinpointLinkRevoke(incidentId: string, linkId: string): Promise<{ ok: true }> {
  return request(
    `/api/incidents/${encodeURIComponent(incidentId)}/pinpoint/links/${encodeURIComponent(linkId)}/revoke`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export async function fetchPinpointLinkDetail(
  incidentId: string,
  linkId: string,
): Promise<import("rapid-cortex-shared").PinpointLinkDispatcherDetail> {
  return request(
    `/api/incidents/${encodeURIComponent(incidentId)}/pinpoint/links/${encodeURIComponent(linkId)}`,
  );
}

export type SurgeClusterBrief = {
  clusterId: string;
  status: string;
  incidentCount: number;
  confidence: number;
  headlineKeywords: string[];
  updatedAt: string;
  createdAt: string;
};

export async function fetchSurgeClusters(incidentId: string): Promise<SurgeClusterBrief[]> {
  const data = await request<{ items: SurgeClusterBrief[] }>(
    `/api/incidents/${encodeURIComponent(incidentId)}/surge/clusters`,
  );
  return data.items;
}

export async function postSurgeAnalyze(incidentId: string): Promise<{ clustersCreated: number }> {
  return request(`/api/incidents/${encodeURIComponent(incidentId)}/surge/analyze`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function fetchSurgeClusterDetail(
  incidentId: string,
  clusterId: string,
): Promise<import("rapid-cortex-shared").SurgeClusterDetail> {
  return request(
    `/api/incidents/${encodeURIComponent(incidentId)}/surge/clusters/${encodeURIComponent(clusterId)}`,
  );
}

export async function postSurgeClusterConfirm(
  incidentId: string,
  clusterId: string,
): Promise<{ ok: true }> {
  return request(
    `/api/incidents/${encodeURIComponent(incidentId)}/surge/clusters/${encodeURIComponent(clusterId)}/confirm`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export async function postSurgeClusterDismiss(
  incidentId: string,
  clusterId: string,
): Promise<{ ok: true }> {
  return request(
    `/api/incidents/${encodeURIComponent(incidentId)}/surge/clusters/${encodeURIComponent(clusterId)}/dismiss`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export async function fetchQaSessions(): Promise<QASession[]> {
  const data = await request<{ items: QASession[] }>("/api/qa/sessions");
  return data.items;
}

export async function fetchQaSession(sessionId: string): Promise<QASession> {
  return request<QASession>(`/api/qa/sessions/${encodeURIComponent(sessionId)}`);
}

export async function postQaSession(body: CreateQASessionInput): Promise<QASession> {
  return request<QASession>("/api/qa/sessions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function patchQaSession(
  sessionId: string,
  body: PatchQASessionInput,
): Promise<QASession> {
  return request<QASession>(`/api/qa/sessions/${encodeURIComponent(sessionId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function postQaSessionScore(sessionId: string): Promise<QASession> {
  return request<QASession>(`/api/qa/sessions/${encodeURIComponent(sessionId)}/score`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function fetchQaTemplates(): Promise<QAProtocolTemplate[]> {
  const data = await request<{ items: QAProtocolTemplate[] }>("/api/qa/templates");
  return data.items;
}

export async function postQaTemplate(body: CreateQAProtocolTemplateInput): Promise<QAProtocolTemplate> {
  return request<QAProtocolTemplate>("/api/qa/templates", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function patchQaTemplate(
  templateId: string,
  body: PatchQAProtocolTemplateInput,
): Promise<QAProtocolTemplate> {
  return request<QAProtocolTemplate>(`/api/qa/templates/${encodeURIComponent(templateId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteQaTemplate(templateId: string): Promise<void> {
  await request<unknown>(`/api/qa/templates/${encodeURIComponent(templateId)}`, {
    method: "DELETE",
  });
}

export async function fetchIncidentMedia(incidentId: string): Promise<IncidentMediaListItem[]> {
  const data = await request<{ items: IncidentMediaListItem[] }>(
    `/api/incidents/${encodeURIComponent(incidentId)}/media`,
  );
  return data.items;
}

export async function postIncidentMediaRequest(
  incidentId: string,
  body: RequestIncidentMediaInput,
): Promise<{
  media: IncidentMediaListItem;
  smsOutcome: {
    provider: string;
    dispatchStatus: "queued" | "sent" | "failed";
    tokenExpiresAt: string;
    errorCode?: string;
  };
}> {
  return request(`/api/incidents/${encodeURIComponent(incidentId)}/media/request`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function postSopDetect(incidentId: string): Promise<unknown> {
  return request(`/api/incidents/${encodeURIComponent(incidentId)}/protocols/sop/detect`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function postAgencySopUploadUrl(
  agencyId: string,
  body: { fileName?: string; contentType?: string } = {},
): Promise<{ uploadUrl: string; key: string; expiresInSeconds: number }> {
  return request(`/api/agencies/${encodeURIComponent(agencyId)}/sop/upload-url`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchTriage(incidentId: string): Promise<TriageResult | null> {
  const data = await request<{ triage: TriageResult | null }>(
    `/api/incidents/${encodeURIComponent(incidentId)}/triage`,
  );
  return data.triage;
}

export async function postTriageOverride(
  incidentId: string,
  body: { bucket: TriageResult["bucket"]; reason?: string },
): Promise<TriageResult> {
  const data = await request<{ triage: TriageResult }>(
    `/api/incidents/${encodeURIComponent(incidentId)}/triage/override`,
    { method: "POST", body: JSON.stringify(body) },
  );
  return data.triage;
}

export async function fetchWellnessTraumaFlags(): Promise<TraumaFlagRecord[]> {
  const data = await request<{ items: TraumaFlagRecord[] }>("/api/wellness/trauma-flags");
  return data.items;
}

export async function postAckTraumaFlag(flagId: string, body: { note?: string } = {}): Promise<void> {
  await request(`/api/wellness/trauma-flags/${encodeURIComponent(flagId)}/ack`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchCallerCard(incidentId: string): Promise<CallerCardResponse> {
  return request<CallerCardResponse>(`/api/incidents/${encodeURIComponent(incidentId)}/caller-card`);
}

export async function postCreatePremiseNote(
  incidentId: string,
  body: CreatePremiseNoteRequest,
): Promise<CreatePremiseNoteResponse> {
  return request<CreatePremiseNoteResponse>(
    `/api/incidents/${encodeURIComponent(incidentId)}/premise-notes`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function patchPremiseNote(
  incidentId: string,
  noteId: string,
  body: PatchPremiseNoteRequest,
): Promise<PatchPremiseNoteResponse> {
  return request<PatchPremiseNoteResponse>(
    `/api/incidents/${encodeURIComponent(incidentId)}/premise-notes/${encodeURIComponent(noteId)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export async function fetchSupervisorPerformanceMetrics(query: {
  from?: string;
  to?: string;
  compareFrom?: string;
  compareTo?: string;
} = {}): Promise<SupervisorPerformanceMetricsResponse> {
  const sp = new URLSearchParams();
  if (query.from) sp.set("from", query.from);
  if (query.to) sp.set("to", query.to);
  if (query.compareFrom) sp.set("compareFrom", query.compareFrom);
  if (query.compareTo) sp.set("compareTo", query.compareTo);
  const q = sp.toString();
  return request<SupervisorPerformanceMetricsResponse>(
    `/api/supervisor/performance/metrics${q ? `?${q}` : ""}`,
  );
}

export async function fetchDispatcherPerformanceDetail(
  dispatcherUserId: string,
  query: { from?: string; to?: string; compareFrom?: string; compareTo?: string } = {},
): Promise<DispatcherPerformanceDetailResponse> {
  const sp = new URLSearchParams();
  if (query.from) sp.set("from", query.from);
  if (query.to) sp.set("to", query.to);
  if (query.compareFrom) sp.set("compareFrom", query.compareFrom);
  if (query.compareTo) sp.set("compareTo", query.compareTo);
  const q = sp.toString();
  return request<DispatcherPerformanceDetailResponse>(
    `/api/supervisor/performance/dispatchers/${encodeURIComponent(dispatcherUserId)}${q ? `?${q}` : ""}`,
  );
}

export async function postDispatcherCoachingNote(body: PostDispatcherCoachingNoteBody): Promise<void> {
  await request(`/api/supervisor/performance/coaching-notes`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchAdminAnalyticsSummary(agencyId?: string): Promise<unknown> {
  const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
  return request<unknown>(`/api/admin/analytics/summary${q}`);
}

export async function postAdminAnalyticsRefresh(agencyId?: string, windowDays?: number): Promise<unknown> {
  const sp = new URLSearchParams();
  if (agencyId) sp.set("agencyId", agencyId);
  if (windowDays != null) sp.set("windowDays", String(windowDays));
  const q = sp.toString();
  return request<unknown>(`/api/admin/analytics/refresh${q ? `?${q}` : ""}`, { method: "POST" });
}

export function buildAdminAnalyticsCsvUrl(agencyId?: string): string {
  const API_BASE = resolveApiBase();
  const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
  return `${API_BASE}/api/admin/analytics/export.csv${q}`;
}

export async function postIncidentShare(
  incidentId: string,
  body: { recipientAgencyId: string; ttlHours?: number },
): Promise<IncidentShareRecord> {
  return request<IncidentShareRecord>(`/api/incidents/${encodeURIComponent(incidentId)}/shares`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchIncidentShares(incidentId: string): Promise<IncidentShareRecord[]> {
  const data = await request<{ items: IncidentShareRecord[] }>(
    `/api/incidents/${encodeURIComponent(incidentId)}/shares`,
  );
  return data.items;
}

export async function revokeIncidentShare(incidentId: string, shareId: string): Promise<void> {
  await request(`/api/incidents/${encodeURIComponent(incidentId)}/shares/${encodeURIComponent(shareId)}`, {
    method: "DELETE",
  });
}

export async function fetchIncomingSharedIncidents(): Promise<
  { share: IncidentShareRecord; incident: Incident }[]
> {
  const data = await request<{ items: { share: IncidentShareRecord; incident: Incident }[] }>(
    "/api/incidents/shared-incoming",
  );
  return data.items;
}

export async function postAgencySharePartner(agencyId: string, partnerAgencyId: string): Promise<void> {
  await request(`/api/agencies/${encodeURIComponent(agencyId)}/share-partners`, {
    method: "POST",
    body: JSON.stringify({ partnerAgencyId }),
  });
}

/** Agency `agencyadmin`, `agencyit`, or `rcsuperadmin` — server enforces. */
export async function fetchDesktopReleasesOverview(): Promise<DesktopReleasesOverviewResponse> {
  return request<DesktopReleasesOverviewResponse>("/api/admin/desktop-releases");
}

export async function postDesktopReleaseSignedUrl(platform: DesktopPlatform): Promise<DesktopSignedUrlResponse> {
  return request<DesktopSignedUrlResponse>("/api/admin/desktop-releases/signed-url", {
    method: "POST",
    body: JSON.stringify({ platform }),
  });
}

/** Agency REST API clients — server enforces `agencyadmin` + tenant scope (`rcsuperadmin` may pass agencyId query). */
export async function fetchAgencyAdminApiClients(agencyId?: string): Promise<unknown[]> {
  const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
  const data = await request<{ items: unknown[] }>(`/api/agency-admin/api-clients${q}`);
  return data.items;
}

export async function postAgencyAdminApiClient(body: Record<string, unknown>): Promise<{
  record?: unknown;
  clientSecret?: string;
  note?: string;
}> {
  return request(`/api/agency-admin/api-clients`, { method: "POST", body: JSON.stringify(body) });
}

export async function patchAgencyAdminApiClientStatus(
  clientId: string,
  body: { status: "disabled" | "revoked" },
  agencyId?: string,
): Promise<void> {
  const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
  await request(`/api/agency-admin/api-clients/${encodeURIComponent(clientId)}${q}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function postAgencyAdminApiClientRotate(
  clientId: string,
  agencyId?: string,
): Promise<{ clientSecret?: string; note?: string }> {
  const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
  return request(`/api/agency-admin/api-clients/${encodeURIComponent(clientId)}/rotate${q}`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function fetchAgencyAdminWebhooks(agencyId?: string): Promise<unknown[]> {
  const q = agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
  const data = await request<{ items: unknown[] }>(`/api/agency-admin/webhooks${q}`);
  return data.items;
}

export async function postAgencyAdminWebhook(body: Record<string, unknown>): Promise<unknown> {
  return request(`/api/agency-admin/webhooks`, { method: "POST", body: JSON.stringify(body) });
}

/** RC Admin — cross-tenant API client oversight (GET /api/rc-admin/api-clients). */
export async function fetchRcAdminApiClients(qs?: { agencyId?: string; status?: string }): Promise<unknown[]> {
  const sp = new URLSearchParams();
  if (qs?.agencyId) sp.set("agencyId", qs.agencyId);
  if (qs?.status) sp.set("status", qs.status);
  const suffix = sp.toString() ? `?${sp.toString()}` : "";
  const data = await request<{ items: unknown[] }>(`/api/rc-admin/api-clients${suffix}`);
  return data.items;
}

/** Cortex SEO Intelligence — internal admin API (`/api/admin/seo/*`). */
export async function fetchSeoOverview(): Promise<{
  scanCount: number;
  openIssues: number;
  lastScanAt: string | null;
  recentScans: Array<{
    id: string;
    url: string;
    pageTitle: string;
    score: number;
    scanStatus: string;
    updatedAt: string;
  }>;
}> {
  return request("/api/admin/seo/overview");
}

export async function fetchSeoSettings(): Promise<{
  seoToolEnabled: boolean;
  seoAutoScanEnabled: boolean;
  seoAiSuggestionsEnabled: boolean;
}> {
  return request("/api/admin/seo/settings");
}

export async function postSeoPageScan(body: {
  url: string;
  keywords?: string[];
  schedule?: "manual" | "daily" | "weekly";
}): Promise<unknown> {
  return request("/api/admin/seo/scans", { method: "POST", body: JSON.stringify(body) });
}

export async function fetchSeoIssues(): Promise<
  Array<{
    id: string;
    agencyId: string;
    url: string;
    severity: string;
    issueType: string;
    description: string;
    recommendation: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  }>
> {
  const data = await request<{ items: unknown[] }>("/api/admin/seo/issues");
  return data.items as Array<{
    id: string;
    agencyId: string;
    url: string;
    severity: string;
    issueType: string;
    description: string;
    recommendation: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

export async function patchSeoIssueStatus(issueId: string, status: "OPEN" | "FIXED" | "IGNORED"): Promise<unknown> {
  return request(`/api/admin/seo/issues/${encodeURIComponent(issueId)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function postSeoKeywordIntel(body: { url: string; keywords: string[] }): Promise<unknown> {
  return request("/api/admin/seo/keywords/analyze", { method: "POST", body: JSON.stringify(body) });
}

export async function postSeoSuggestions(body: { url: string; keywords?: string[]; context?: string }): Promise<unknown> {
  return request("/api/admin/seo/suggestions", { method: "POST", body: JSON.stringify(body) });
}

export async function generateSeoSchemaSnippet(
  type:
    | "Organization"
    | "SoftwareApplication"
    | "Product"
    | "FAQPage"
    | "LocalBusiness"
    | "Article"
    | "BreadcrumbList",
  payload: Record<string, unknown>,
): Promise<{ jsonLd: Record<string, unknown> }> {
  return request("/api/admin/seo/schema/generate", {
    method: "POST",
    body: JSON.stringify({ type, payload }),
  });
}

export async function getSeoSitemapReport(origin: string): Promise<unknown> {
  const q = `?origin=${encodeURIComponent(origin)}`;
  return request(`/api/admin/seo/sitemap-check${q}`);
}

/** Deception Shield telemetry (internal — rcsuperadmin/agencyit/rcitadmin backend RBAC only). */
export async function fetchDeceptionEvents(payload?: {
  riskLevel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  since?: "24h";
  limit?: number;
}): Promise<{
  items: Array<{
    id: string;
    eventType: string;
    riskLevel: string;
    route: string;
    method: string;
    sourceIp: string;
    userAgent: string;
    honeytokenUsed?: string;
    payloadSummary?: string;
    headersSummary?: string;
    querySummary?: string;
    correlationId: string;
    touchedRealRouteRecently: boolean;
    createdAt: string;
  }>;
}> {
  const sp = new URLSearchParams();
  if (payload?.riskLevel) sp.set("riskLevel", payload.riskLevel);
  if (payload?.since) sp.set("since", payload.since);
  if (payload?.limit != null) sp.set("limit", String(payload.limit));
  const suffix = sp.toString() ? `?${sp.toString()}` : "";
  return request(`/api/admin/security/deception-events${suffix}`);
}

export async function postSeoCompetitorOutline(
  topicId:
    | "rapid-cortex-vs-legacy-cad"
    | "rapid-cortex-vs-ng911-media-only"
    | "rc-lite-api-cad-vendors"
    | "emergency-response-intelligence"
    | "911-dispatcher-decision-support",
): Promise<unknown> {
  return request("/api/admin/seo/competitor-outline", {
    method: "POST",
    body: JSON.stringify({ topicId }),
  });
}

// --- CAD admin (stack-1 `/api/admin/cad-*`) ---------------------------------

export type CadAdminIntegration = {
  id: string;
  agencyId: string;
  name: string;
  vendor: string;
  status: string;
  connectionType: string;
  config: Record<string, unknown>;
  hasWebhookSecret: boolean;
  webhookUrl: string;
  setupInstructions: string;
  lastPingAt?: string;
  lastIncidentAt?: string;
  errorMessage?: string;
  incidentCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CadRawIncidentRow = {
  id: string;
  agencyId: string;
  integrationId: string;
  receivedAt: string;
  rawBody: string;
  status: string;
  errorMessage?: string;
  linkedIncidentId?: string;
};

export async function fetchCadIntegrations(): Promise<{ items: CadAdminIntegration[] }> {
  return request("/api/admin/cad-integrations");
}

export async function postCadIntegration(body: {
  vendor: string;
  connectionType: string;
  name: string;
  config: Record<string, unknown>;
}): Promise<{ integration: CadAdminIntegration; webhookSecret: string }> {
  return request("/api/admin/cad-integrations", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function patchCadIntegration(
  id: string,
  body: {
    status?: "active" | "inactive" | "error" | "testing";
    name?: string;
    config?: Record<string, unknown>;
    regenerateToken?: boolean;
  },
): Promise<{ integration: CadAdminIntegration | null; webhookSecret?: string }> {
  return request(`/api/admin/cad-integrations/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteCadIntegration(id: string): Promise<{ deleted: boolean }> {
  return request(`/api/admin/cad-integrations/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function postCadIntegrationTest(id: string): Promise<{
  success: boolean;
  latencyMs: number;
  message: string;
  details?: Record<string, unknown>;
}> {
  return request(`/api/admin/cad-integrations/${encodeURIComponent(id)}/test`, {
    method: "POST",
  });
}

export async function fetchCadIncidents(params?: {
  since?: string;
  limit?: number;
  integrationId?: string;
}): Promise<{ items: CadRawIncidentRow[] }> {
  const sp = new URLSearchParams();
  if (params?.since) sp.set("since", params.since);
  if (params?.limit != null) sp.set("limit", String(params.limit));
  if (params?.integrationId) sp.set("integrationId", params.integrationId);
  const q = sp.toString();
  return request(`/api/admin/cad-incidents${q ? `?${q}` : ""}`);
}

export async function fetchCadWritebackApprovals(params?: {
  status?: string;
  since?: string;
}): Promise<{ items: CadWritebackAuditRecord[] }> {
  const sp = new URLSearchParams();
  if (params?.status) sp.set("status", params.status);
  if (params?.since) sp.set("since", params.since);
  const q = sp.toString();
  return request(`/api/admin/cad-writeback-approvals${q ? `?${q}` : ""}`);
}

export async function postCadWritebackApprove(id: string): Promise<{ ok: boolean; cadResponse?: string; error?: string }> {
  return request(`/api/admin/cad-writeback-approvals/${encodeURIComponent(id)}/approve`, { method: "POST" });
}

export async function postCadWritebackReject(
  id: string,
  body?: { notes?: string },
): Promise<{ ok: boolean }> {
  return request(`/api/admin/cad-writeback-approvals/${encodeURIComponent(id)}/reject`, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

export async function fetchSupervisorActiveCalls(): Promise<ActiveCallRecord[]> {
  const data = await request<ActiveCallsListResponse>("/api/supervisor/active-calls");
  return data.items;
}

export async function fetchDispatcherActiveCalls(): Promise<ActiveCallRecord[]> {
  const data = await request<ActiveCallsListResponse>("/api/dispatcher/active-calls");
  return data.items;
}

export async function postSupervisorTransferCall(body: TransferCallBody): Promise<TransferCallResponse> {
  return request<TransferCallResponse>("/api/supervisor/transfer-call", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function postSupervisorTakeoverCall(body: TakeoverCallBody): Promise<TransferCallResponse> {
  return request<TransferCallResponse>("/api/supervisor/takeover-call", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function postDispatcherAcceptTransfer(body: CallIdBody): Promise<{ success: boolean; call: ActiveCallRecord }> {
  return request("/api/dispatcher/accept-transfer", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function postDispatcherDeclineTransfer(body: CallIdBody): Promise<{ success: boolean; call: ActiveCallRecord }> {
  return request("/api/dispatcher/decline-transfer", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchAgencyEntitlements(): Promise<{
  entitlements: TenantEntitlements;
  catalog: AddonDefinition[];
}> {
  const res = await request<{ data: { entitlements: TenantEntitlements; catalog: AddonDefinition[] } }>(
    "/api/agency/entitlements",
  );
  return res.data;
}

export async function fetchAdminTenantEntitlements(tenantId: string): Promise<{
  entitlements: TenantEntitlements;
  catalog: AddonDefinition[];
}> {
  const res = await request<{ data: { entitlements: TenantEntitlements; catalog: AddonDefinition[] } }>(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/entitlements`,
  );
  return res.data;
}

export async function fetchAdminTenantCurrentInvoice(tenantId: string): Promise<{
  invoice: Record<string, unknown> | null;
}> {
  const res = await request<{ data: { invoice: Record<string, unknown> | null } }>(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/invoice/current`,
  );
  return res.data;
}

export async function patchAdminTenantAddon(
  tenantId: string,
  body: PatchTenantAddonBody,
): Promise<{ entitlements: TenantEntitlements; invoiceDelta: Record<string, unknown> }> {
  const res = await request<{ data: { entitlements: TenantEntitlements; invoiceDelta: Record<string, unknown> } }>(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/entitlements`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
  return res.data;
}

export async function fetchAdminTenantEntitlementsAudit(
  tenantId: string,
  limit = 20,
): Promise<{ items: BillingAuditEventRecord[] }> {
  const res = await request<{
    data: { items: BillingAuditEventRecord[] };
  }>(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/entitlements/audit?limit=${limit}`,
  );
  return res.data;
}

export async function fetchAdminTenantAddons(tenantId: string): Promise<{
  agencyId: string;
  addons: string[];
}> {
  return request(`/api/admin/tenants/${encodeURIComponent(tenantId)}/addons`);
}

export async function postAdminTenantAddon(
  tenantId: string,
  addonKey: string,
): Promise<{ agencyId: string; addons: string[]; syncedUsers: number }> {
  return request(`/api/admin/tenants/${encodeURIComponent(tenantId)}/addons/${encodeURIComponent(addonKey)}`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function deleteAdminTenantAddon(
  tenantId: string,
  addonKey: string,
): Promise<{ agencyId: string; addons: string[]; syncedUsers: number }> {
  return request(`/api/admin/tenants/${encodeURIComponent(tenantId)}/addons/${encodeURIComponent(addonKey)}`, {
    method: "DELETE",
  });
}

export type AdminInvoiceListItem = {
  invoiceId: string;
  agencyId: string;
  agencyName: string;
  vertical: string;
  invoiceNumber?: string;
  status: string;
  displayStatus: string;
  subtotal: number | null;
  total: number | null;
  dueDate?: string;
  paidAt?: string;
  purchaseOrderNumber?: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminInvoicesListResponse = {
  items: AdminInvoiceListItem[];
  stats: {
    totalInvoices: number;
    outstandingCents: number;
    overdueCents: number;
    paidThisMonthCents: number;
  };
  note?: string;
};

export async function fetchAdminInvoices(params?: {
  limit?: number;
  status?: string;
  agencyId?: string;
  vertical?: string;
  search?: string;
  from?: string;
  to?: string;
}): Promise<AdminInvoicesListResponse> {
  const q = new URLSearchParams();
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.status) q.set("status", params.status);
  if (params?.agencyId) q.set("agencyId", params.agencyId);
  if (params?.vertical) q.set("vertical", params.vertical);
  if (params?.search) q.set("search", params.search);
  if (params?.from) q.set("from", params.from);
  if (params?.to) q.set("to", params.to);
  const suffix = q.toString();
  return request<AdminInvoicesListResponse>(`/api/admin/invoices${suffix ? `?${suffix}` : ""}`);
}

export async function fetchAdminInvoice(invoiceId: string): Promise<{ invoice: AdminInvoiceListItem & { lineItems: unknown[] } }> {
  return request(`/api/admin/invoices/${encodeURIComponent(invoiceId)}`);
}

export async function patchAdminInvoice(
  invoiceId: string,
  body: { status?: string; purchaseOrderNumber?: string; dueDate?: string },
): Promise<{ invoice: AdminInvoiceListItem }> {
  return request(`/api/admin/invoices/${encodeURIComponent(invoiceId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export type BillingServiceCatalogRow = {
  serviceId: string;
  name: string;
  description?: string;
  category: string;
  defaultPrice: number;
  billingType: string;
  active: boolean;
  displayOrder?: number;
};

export async function fetchBillingServices(opts?: {
  active?: boolean;
  agencyId?: string;
}): Promise<{ items: BillingServiceCatalogRow[] }> {
  const q = new URLSearchParams();
  if (opts?.active !== false) q.set("active", "true");
  if (opts?.agencyId) q.set("agencyId", opts.agencyId);
  const suffix = q.toString();
  return request(`/api/billing/services${suffix ? `?${suffix}` : ""}`);
}
