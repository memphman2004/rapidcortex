import {
  assertCampusAlertsHigherEdCampus,
  CAMPUS_ALERTS_CONSENT_VERSION,
  campusAlertsConfigSchema,
  canInitiateCampusAlertsEmergencySms,
  confirmCampusAlertsOtpBodySchema,
  confirmEmergencyBroadcastBodySchema,
  estimateEmergencyBroadcastCost,
  isCampusAlertsFeatureEnabled,
  isCampusAlertsMassSmsClassification,
  normalizePhoneE164,
  previewEmergencyBroadcastBodySchema,
  registerCampusAlertsBodySchema,
  renewCampusAlertsBodySchema,
  startCampusAlertsVerifyBodySchema,
  type CampusAlertSubscriptionPublic,
  type CampusAlertSubscriptionStaff,
  type CampusAlertsConfig,
  type CampusAlertsEmergencyPreview,
  type CampusAlertsUsageRecordStaff,
  type UserContext,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import { maskPhoneLast4 } from "../../lib/phone-hash.js";
import { PublicBurstLimiter } from "../../lib/publicRateLimiter.js";
import { buildSmsFactoryEnvForAgency } from "../../lib/smsFactoryEnv.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { AgencyRepository } from "../../repositories/agencyRepository.js";
import { QrNfcRepository } from "../../repositories/qrNfcRepository.js";
import { sendIncidentMediaLinkSms } from "../../services/sms/smsProviderFactory.js";
import { alertsStore } from "../../alerts/store.js";
import {
  campusAlertsPhoneLookupDigest,
  decryptCampusAlertsPhone,
  encryptCampusAlertsPhone,
  generateSixDigitOtp,
  hashCampusAlertsOtp,
  otpPepper,
} from "./campus-alerts-crypto.js";
import { CAMPUS_ALERTS_KEYS } from "./campus-alerts-keys.js";
import {
  CampusAlertsRepository,
  type CampusAlertCampaignItem,
  type CampusAlertChallengeItem,
  type CampusAlertPreviewItem,
  type CampusAlertSubscriptionItem,
} from "./campus-alerts-repository.js";

const repo = new CampusAlertsRepository();
const agencies = new AgencyRepository();
const qrRepo = new QrNfcRepository();
const auditRepo = new AuditRepository();

const otpStartLimiter = new PublicBurstLimiter(5, 60 * 60 * 1000);
const otpConfirmLimiter = new PublicBurstLimiter(20, 60 * 60 * 1000);

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

function nowIso(): string {
  return new Date().toISOString();
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function assertPlatformEnabled(): void {
  if (!env.enableCampusAlerts) {
    const err = new Error("CAMPUS_ALERTS_DISABLED");
    (err as Error & { statusCode?: number }).statusCode = 503;
    throw err;
  }
}

function fail(message: string, statusCode: number): never {
  const err = new Error(message);
  (err as Error & { statusCode?: number }).statusCode = statusCode;
  throw err;
}

async function resolveCampusAgency(agencyId: string): Promise<{
  agency: NonNullable<Awaited<ReturnType<AgencyRepository["get"]>>>;
  campus: Record<string, unknown> | undefined;
  alertsCfg: CampusAlertsConfig;
  universityName: string;
}> {
  const agency = await agencies.get(agencyId);
  if (!agency) fail("NOT_FOUND", 404);
  const campus = (agency as { config?: { campus?: Record<string, unknown> } }).config?.campus;
  assertCampusAlertsHigherEdCampus({
    vertical: "campus",
    agencyType: (agency as { type?: string }).type,
    institutionType:
      (agency as { institutionType?: unknown }).institutionType ?? campus?.institutionType,
    campusType: campus?.campusType,
  });
  const parsed = campusAlertsConfigSchema.safeParse(campus?.campusAlerts ?? {});
  const alertsCfg = parsed.success ? parsed.data : campusAlertsConfigSchema.parse({});
  if (
    !isCampusAlertsFeatureEnabled({
      platformEnabled: env.enableCampusAlerts,
      tenantEnabled: alertsCfg.enabled === true,
      selfRegistrationEnabled: alertsCfg.selfRegistrationEnabled !== false,
      vertical: "campus",
      agencyType: (agency as { type?: string }).type,
      institutionType:
        (agency as { institutionType?: unknown }).institutionType ?? campus?.institutionType,
      campusType: campus?.campusType,
    })
  ) {
    fail("CAMPUS_ALERTS_NOT_ENABLED", 403);
  }
  const universityName =
    String(campus?.displayName ?? "").trim() ||
    String((agency as { name?: string }).name ?? "").trim() ||
    agencyId;
  return { agency, campus, alertsCfg, universityName };
}

function toPublicSubscription(
  sub: CampusAlertSubscriptionItem,
  universityName: string,
): CampusAlertSubscriptionPublic {
  const active =
    sub.status === "SUBSCRIBED" || sub.status === "RENEWAL_DUE" || sub.status === "PENDING_VERIFICATION";
  return {
    status: sub.status,
    maskedPhone: sub.maskedPhone,
    universityName,
    renewalDueAt: sub.renewalDueAt,
    subscriptionExpiresAt: sub.subscriptionExpiresAt,
    alreadyRegistered: active && sub.status !== "PENDING_VERIFICATION",
  };
}

function toStaff(sub: CampusAlertSubscriptionItem): CampusAlertSubscriptionStaff {
  return {
    subscriptionId: sub.subscriptionId,
    agencyId: sub.agencyId,
    siteCodes: sub.siteCodes,
    status: sub.status,
    maskedPhone: sub.maskedPhone,
    registrationCreatedAt: sub.registrationCreatedAt,
    lastVerifiedAt: sub.lastVerifiedAt,
    lastRenewedAt: sub.lastRenewedAt,
    renewalDueAt: sub.renewalDueAt,
    subscriptionExpiresAt: sub.subscriptionExpiresAt,
    consentGrantedAt: sub.consentGrantedAt,
    consentVersion: sub.consentVersion,
    sourceSafetyPointId: sub.sourceSafetyPointId,
    createdAt: sub.createdAt,
    updatedAt: sub.updatedAt,
  };
}

function isBroadcastEligible(sub: CampusAlertSubscriptionItem, now = Date.now()): boolean {
  if (sub.status !== "SUBSCRIBED" && sub.status !== "RENEWAL_DUE") return false;
  if (sub.subscriptionExpiresAt && Date.parse(sub.subscriptionExpiresAt) < now) return false;
  if (sub.optedOutAt) return false;
  return true;
}

async function requireVerifiedChallenge(challengeId: string): Promise<{
  challenge: CampusAlertChallengeItem;
  phoneE164: string;
}> {
  const challenge = await repo.getChallenge(challengeId);
  if (!challenge) fail("NOT_FOUND", 404);
  if (challenge.consumedAt) fail("VALIDATION:Verification session already used", 400);
  if (!challenge.verifiedAt) fail("VALIDATION:Phone number not verified", 400);
  if (Date.parse(challenge.expiresAt) < Date.now()) fail("VALIDATION:Verification expired", 400);
  const phoneE164 = await decryptCampusAlertsPhone(challenge.phoneE164Encrypted);
  return { challenge, phoneE164 };
}

export class CampusAlertsService {
  async isAvailableForAgency(agencyId: string): Promise<boolean> {
    try {
      assertPlatformEnabled();
      await resolveCampusAgency(agencyId);
      return true;
    } catch {
      return false;
    }
  }

  async startVerify(
    rawBody: unknown,
    abuseKey: string,
  ): Promise<{ challengeId: string; expiresAt: string; universityName: string; maskedPhone: string }> {
    assertPlatformEnabled();
    if (!otpStartLimiter.allow(`casub-start:${abuseKey}`)) {
      fail("RATE_LIMITED", 429);
    }
    const body = startCampusAlertsVerifyBodySchema.parse(rawBody);
    const phoneE164 = normalizePhoneE164(body.phone);
    if (!/^\+[1-9]\d{6,14}$/.test(phoneE164)) {
      fail("VALIDATION:Enter a valid mobile phone number", 400);
    }

    const record = await qrRepo.getByQrId(body.qrId);
    if (!record?.active || record.vertical !== "campus") fail("NOT_FOUND", 404);

    const { alertsCfg, universityName } = await resolveCampusAgency(record.agencyId);

    const isDnc = await alertsStore.isDnc(record.agencyId, phoneE164).catch(() => false);
    // Do not disclose DNC; still send OTP so user can complete flow if they re-consent later.
    void isDnc;

    const challengeId = makeId("chal");
    const code = generateSixDigitOtp();
    const pepper = await otpPepper();
    const otpHash = hashCampusAlertsOtp(code, challengeId, pepper);
    const now = nowIso();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
    const phoneE164Encrypted = await encryptCampusAlertsPhone(phoneE164);
    const phoneLookupDigest = await campusAlertsPhoneLookupDigest(record.agencyId, phoneE164);
    const maskedPhone = maskPhoneLast4(phoneE164);

    const challenge: CampusAlertChallengeItem = {
      pk: CAMPUS_ALERTS_KEYS.challengePk(challengeId),
      sk: CAMPUS_ALERTS_KEYS.challengeSk(),
      entityType: "CASUB_CHALLENGE",
      challengeId,
      agencyId: record.agencyId,
      universityName,
      qrId: body.qrId,
      medium: body.medium,
      phoneE164Encrypted,
      phoneLookupDigest,
      maskedPhone,
      otpHash,
      attempts: 0,
      maxAttempts: OTP_MAX_ATTEMPTS,
      expiresAt,
      smsConsentAt: now,
      consentVersion: alertsCfg.consentTextVersion || CAMPUS_ALERTS_CONSENT_VERSION,
      resendAvailableAt: new Date(Date.now() + RESEND_COOLDOWN_MS).toISOString(),
      createdAt: now,
      ttl: Math.floor(Date.now() / 1000) + 3600,
    };
    await repo.putChallenge(challenge);

    const sms = await sendIncidentMediaLinkSms(await buildSmsFactoryEnvForAgency(record.agencyId), {
      toPhoneE164: phoneE164,
      messageBody: `NexCort iQ Campus Alerts code: ${code}. Expires in 10 minutes. Do not share this code.`,
      agencyId: record.agencyId,
      incidentId: challengeId,
      messageType: "campus_alerts_otp",
    });
    if (sms.status === "failed") {
      fail("VALIDATION:We couldn't send a verification code. Please try again.", 400);
    }

    // Never log OTP / plaintext phone.
    console.info(
      JSON.stringify({
        type: "campus_alerts.otp_sent",
        agencyId: record.agencyId,
        challengeId,
        maskedPhone,
      }),
    );

    return { challengeId, expiresAt, universityName, maskedPhone };
  }

  async confirmOtp(
    rawBody: unknown,
    abuseKey: string,
  ): Promise<{
    next: "renew" | "register";
    challengeId: string;
    universityName: string;
    maskedPhone: string;
    subscription?: CampusAlertSubscriptionPublic;
  }> {
    assertPlatformEnabled();
    if (!otpConfirmLimiter.allow(`casub-confirm:${abuseKey}`)) {
      fail("RATE_LIMITED", 429);
    }
    const body = confirmCampusAlertsOtpBodySchema.parse(rawBody);
    const challenge = await repo.getChallenge(body.challengeId);
    if (!challenge) fail("NOT_FOUND", 404);
    if (challenge.consumedAt) fail("VALIDATION:Verification session already used", 400);
    if (Date.parse(challenge.expiresAt) < Date.now()) {
      fail("VALIDATION:We couldn't verify this number. Please try again or contact campus support.", 400);
    }
    if (challenge.attempts >= challenge.maxAttempts) {
      fail("VALIDATION:We couldn't verify this number. Please try again or contact campus support.", 400);
    }

    const pepper = await otpPepper();
    const expected = hashCampusAlertsOtp(body.code, challenge.challengeId, pepper);
    if (expected !== challenge.otpHash) {
      await repo.updateChallenge(challenge.challengeId, { attempts: challenge.attempts + 1 });
      fail("VALIDATION:We couldn't verify this number. Please try again or contact campus support.", 400);
    }

    await repo.updateChallenge(challenge.challengeId, {
      verifiedAt: nowIso(),
      // Invalidate OTP hash after success (no plaintext was stored).
      otpHash: hashCampusAlertsOtp("used", challenge.challengeId, pepper),
    });

    const { universityName } = await resolveCampusAgency(challenge.agencyId);
    const phoneIndex = await repo.getByPhoneDigest(challenge.agencyId, challenge.phoneLookupDigest);
    if (phoneIndex) {
      const sub = await repo.getSubscription(challenge.agencyId, phoneIndex.subscriptionId);
      if (sub && (sub.status === "SUBSCRIBED" || sub.status === "RENEWAL_DUE" || sub.status === "EXPIRED")) {
        return {
          next: "renew",
          challengeId: challenge.challengeId,
          universityName,
          maskedPhone: challenge.maskedPhone,
          subscription: toPublicSubscription(sub, universityName),
        };
      }
    }

    return {
      next: "register",
      challengeId: challenge.challengeId,
      universityName,
      maskedPhone: challenge.maskedPhone,
    };
  }

  async renew(rawBody: unknown): Promise<{
    message: string;
    subscription: CampusAlertSubscriptionPublic;
  }> {
    assertPlatformEnabled();
    const body = renewCampusAlertsBodySchema.parse(rawBody);
    const { challenge, phoneE164 } = await requireVerifiedChallenge(body.challengeId);
    const { alertsCfg, universityName } = await resolveCampusAgency(challenge.agencyId);

    const phoneIndex = await repo.getByPhoneDigest(challenge.agencyId, challenge.phoneLookupDigest);
    if (!phoneIndex) fail("VALIDATION:No active registration found for this number", 400);
    const existing = await repo.getSubscription(challenge.agencyId, phoneIndex.subscriptionId);
    if (!existing) fail("VALIDATION:No active registration found for this number", 400);
    if (existing.status === "UNSUBSCRIBED" || existing.status === "SUPPRESSED") {
      fail("VALIDATION:This number must re-enroll with explicit consent", 400);
    }

    const now = nowIso();
    const validityDays = alertsCfg.registrationValidityDays || 365;
    const expiresAt = addDays(now, validityDays);
    const updated = await repo.updateSubscription(challenge.agencyId, existing.subscriptionId, {
      status: "SUBSCRIBED",
      lastVerifiedAt: now,
      lastRenewedAt: now,
      renewalDueAt: expiresAt,
      subscriptionExpiresAt: expiresAt,
      consentGrantedAt: now,
      consentVersion: challenge.consentVersion,
      consentSource: "qr_nfc_renewal",
      phoneE164Encrypted: await encryptCampusAlertsPhone(phoneE164),
      maskedPhone: maskPhoneLast4(phoneE164),
      sourceSafetyPointId: challenge.qrId,
    });
    await repo.putPhoneIndex({
      pk: CAMPUS_ALERTS_KEYS.agencyPk(challenge.agencyId),
      sk: CAMPUS_ALERTS_KEYS.phoneIndexSk(challenge.phoneLookupDigest),
      entityType: "CASUB_PHONE",
      agencyId: challenge.agencyId,
      subscriptionId: existing.subscriptionId,
      phoneLookupDigest: challenge.phoneLookupDigest,
      status: "SUBSCRIBED",
      updatedAt: now,
    });
    await repo.updateChallenge(challenge.challengeId, { consumedAt: now });

    try {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: challenge.agencyId,
        actorId: "public-campus-alerts",
        type: AUDIT_EVENT_TYPES.PUBLIC_REPORT_SUBMITTED,
        details: {
          source: "campus_alerts",
          action: "renewal",
          subscriptionId: existing.subscriptionId,
          consentVersion: challenge.consentVersion,
        },
        createdAt: now,
        resourceType: "integration",
        resourceId: existing.subscriptionId,
      });
    } catch {
      // non-fatal
    }

    const renewalDate = new Date(expiresAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
    return {
      message: `Thank you! Your phone number has been verified and your Campus Alerts registration has been renewed. You will continue receiving eligible campus safety notifications. Your next renewal is due on ${renewalDate}.`,
      subscription: toPublicSubscription(updated, universityName),
    };
  }

  async register(rawBody: unknown): Promise<{
    message: string;
    subscription: CampusAlertSubscriptionPublic;
    previousNumberRemoved?: boolean;
  }> {
    assertPlatformEnabled();
    const body = registerCampusAlertsBodySchema.parse(rawBody);
    const { challenge, phoneE164 } = await requireVerifiedChallenge(body.challengeId);
    const { alertsCfg, universityName } = await resolveCampusAgency(challenge.agencyId);
    const now = nowIso();
    const validityDays = alertsCfg.registrationValidityDays || 365;
    const expiresAt = addDays(now, validityDays);

    // Existing active digest → treat as renew path (idempotent).
    const existingIdx = await repo.getByPhoneDigest(challenge.agencyId, challenge.phoneLookupDigest);
    if (existingIdx) {
      const existing = await repo.getSubscription(challenge.agencyId, existingIdx.subscriptionId);
      if (existing && (existing.status === "SUBSCRIBED" || existing.status === "RENEWAL_DUE")) {
        fail("VALIDATION:You're already registered. Verify and renew to keep your information current.", 409);
      }
    }

    let previousNumberRemoved = false;

    if (body.path === "changed_number" && body.previousPhoneAccessible === true) {
      if (!body.previousPhone || !body.previousChallengeId || !body.previousCode) {
        fail("VALIDATION:Previous number verification is required", 400);
      }
      const prevChallenge = await repo.getChallenge(body.previousChallengeId);
      if (!prevChallenge?.verifiedAt || prevChallenge.agencyId !== challenge.agencyId) {
        fail("VALIDATION:Previous number was not verified", 400);
      }
      const prevPhone = await decryptCampusAlertsPhone(prevChallenge.phoneE164Encrypted);
      const expectedPrev = normalizePhoneE164(body.previousPhone);
      if (prevPhone !== expectedPrev) {
        fail("VALIDATION:Previous number verification does not match", 400);
      }
      const prevDigest = await campusAlertsPhoneLookupDigest(challenge.agencyId, prevPhone);
      const prevIdx = await repo.getByPhoneDigest(challenge.agencyId, prevDigest);
      if (prevIdx) {
        await repo.updateSubscription(challenge.agencyId, prevIdx.subscriptionId, {
          status: "UNSUBSCRIBED",
          optedOutAt: now,
          suppressionReason: "phone_number_changed",
        });
        await repo.putPhoneIndex({
          pk: CAMPUS_ALERTS_KEYS.agencyPk(challenge.agencyId),
          sk: CAMPUS_ALERTS_KEYS.phoneIndexSk(prevDigest),
          entityType: "CASUB_PHONE",
          agencyId: challenge.agencyId,
          subscriptionId: prevIdx.subscriptionId,
          phoneLookupDigest: prevDigest,
          status: "UNSUBSCRIBED",
          updatedAt: now,
        });
        previousNumberRemoved = true;
      }
      await repo.updateChallenge(body.previousChallengeId, { consumedAt: now });
    }
    // previousPhoneAccessible === false: never unlink another person's registration.

    const subscriptionId = makeId("casub");
    const subscription: CampusAlertSubscriptionItem = {
      pk: CAMPUS_ALERTS_KEYS.agencyPk(challenge.agencyId),
      sk: CAMPUS_ALERTS_KEYS.subscriptionSk(subscriptionId),
      entityType: "CASUB",
      subscriptionId,
      agencyId: challenge.agencyId,
      phoneE164Encrypted: await encryptCampusAlertsPhone(phoneE164),
      phoneLookupDigest: challenge.phoneLookupDigest,
      maskedPhone: maskPhoneLast4(phoneE164),
      status: "SUBSCRIBED",
      registrationCreatedAt: now,
      lastVerifiedAt: now,
      lastRenewedAt: now,
      renewalDueAt: expiresAt,
      subscriptionExpiresAt: expiresAt,
      consentGrantedAt: challenge.smsConsentAt,
      consentVersion: challenge.consentVersion,
      consentSource:
        body.path === "changed_number" ? "qr_nfc_phone_change" : "qr_nfc_first_registration",
      sourceSafetyPointId: challenge.qrId,
      createdAt: now,
      updatedAt: now,
    };

    const result = await repo.createSubscriptionAtomic(subscription, {
      pk: CAMPUS_ALERTS_KEYS.agencyPk(challenge.agencyId),
      sk: CAMPUS_ALERTS_KEYS.phoneIndexSk(challenge.phoneLookupDigest),
      entityType: "CASUB_PHONE",
      agencyId: challenge.agencyId,
      subscriptionId,
      phoneLookupDigest: challenge.phoneLookupDigest,
      status: "SUBSCRIBED",
      updatedAt: now,
    });
    if (result === "duplicate") {
      fail("VALIDATION:You're already registered. Verify and renew to keep your information current.", 409);
    }

    await repo.updateChallenge(challenge.challengeId, { consumedAt: now });

    try {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: challenge.agencyId,
        actorId: "public-campus-alerts",
        type: AUDIT_EVENT_TYPES.PUBLIC_REPORT_SUBMITTED,
        details: {
          source: "campus_alerts",
          action: body.path,
          subscriptionId,
          previousNumberRemoved,
          consentVersion: challenge.consentVersion,
        },
        createdAt: now,
        resourceType: "integration",
        resourceId: subscriptionId,
      });
    } catch {
      // non-fatal
    }

    const until = new Date(expiresAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
    const message =
      body.path === "changed_number"
        ? previousNumberRemoved
          ? "Your current phone number has been registered successfully. Your previous number was removed from Campus Alerts for this university. Thank you for keeping your Campus Alerts information up to date."
          : "Your current phone number has been registered successfully. Thank you for keeping your Campus Alerts information up to date."
        : `Thank you for registering for NexCort iQ Campus Alerts! Your mobile number has been successfully verified. You'll receive eligible campus safety notifications from ${universityName}. Your registration is valid until ${until}.`;

    return {
      message,
      subscription: toPublicSubscription(subscription, universityName),
      ...(body.path === "changed_number" ? { previousNumberRemoved } : {}),
    };
  }

  async staffMetrics(
    campusCode: string,
    user: UserContext,
  ): Promise<{
    universityName: string;
    totals: Record<string, number>;
    items: CampusAlertSubscriptionStaff[];
  }> {
    assertPlatformEnabled();
    const agencyId = user.agencyId;
    if (!agencyId) fail("FORBIDDEN", 403);
    const { universityName } = await resolveCampusAgency(agencyId);
    void campusCode;
    const items = await repo.listSubscriptions(agencyId);
    const now = Date.now();
    const in30 = now + 30 * 24 * 3600 * 1000;
    const totals = {
      active: 0,
      renewalDue30: 0,
      expired: 0,
      unsubscribed: 0,
      suppressed: 0,
      total: items.length,
    };
    for (const s of items) {
      if (s.status === "SUBSCRIBED" || s.status === "RENEWAL_DUE") totals.active += 1;
      if (s.status === "EXPIRED") totals.expired += 1;
      if (s.status === "UNSUBSCRIBED") totals.unsubscribed += 1;
      if (s.status === "SUPPRESSED") totals.suppressed += 1;
      if (
        s.renewalDueAt &&
        Date.parse(s.renewalDueAt) <= in30 &&
        (s.status === "SUBSCRIBED" || s.status === "RENEWAL_DUE")
      ) {
        totals.renewalDue30 += 1;
      }
    }
    return {
      universityName,
      totals,
      items: items.slice(0, 100).map(toStaff),
    };
  }

  /** Mark expired subscriptions (server-authoritative; do not rely on Dynamo TTL alone). */
  async expireDueSubscriptions(agencyId: string): Promise<{ expired: number }> {
    assertPlatformEnabled();
    await resolveCampusAgency(agencyId);
    const items = await repo.listSubscriptions(agencyId);
    const now = Date.now();
    let expired = 0;
    for (const s of items) {
      if (s.status !== "SUBSCRIBED" && s.status !== "RENEWAL_DUE") continue;
      const due = s.subscriptionExpiresAt ? Date.parse(s.subscriptionExpiresAt) : NaN;
      if (!Number.isFinite(due) || due > now) continue;
      await repo.updateSubscription(agencyId, s.subscriptionId, { status: "EXPIRED" });
      await repo.putPhoneIndex({
        pk: CAMPUS_ALERTS_KEYS.agencyPk(agencyId),
        sk: CAMPUS_ALERTS_KEYS.phoneIndexSk(s.phoneLookupDigest),
        entityType: "CASUB_PHONE",
        agencyId,
        subscriptionId: s.subscriptionId,
        phoneLookupDigest: s.phoneLookupDigest,
        status: "EXPIRED",
        updatedAt: nowIso(),
      });
      expired += 1;
    }
    return { expired };
  }

  /**
   * Eligible recipients for emergency mass SMS only.
   * Non-emergency classifications (including ANNUAL_RENEWAL) are rejected server-side.
   */
  async selectEligibleForBroadcast(
    agencyId: string,
    broadcastId: string,
    classification: string,
  ): Promise<{ subscriptionId: string; phoneE164: string }[]> {
    assertPlatformEnabled();
    const { alertsCfg } = await resolveCampusAgency(agencyId);
    if (!isCampusAlertsMassSmsClassification(classification as never)) {
      fail("VALIDATION:Mass SMS is reserved for qualifying campus emergencies", 403);
    }
    if (classification === "ALL_CLEAR" && alertsCfg.allClearMassSmsEnabled === false) {
      fail("VALIDATION:ALL_CLEAR mass SMS is disabled for this university", 403);
    }
    if (alertsCfg.emergencyMassSmsEnabled === false) {
      fail("VALIDATION:Emergency mass SMS is disabled for this university", 403);
    }
    return this.collectEligibleRecipients(agencyId, broadcastId);
  }

  private async collectEligibleRecipients(
    agencyId: string,
    broadcastId: string,
  ): Promise<{ subscriptionId: string; phoneE164: string }[]> {
    const items = await repo.listSubscriptions(agencyId);
    const out: { subscriptionId: string; phoneE164: string }[] = [];
    for (const s of items) {
      if (!isBroadcastEligible(s)) continue;
      const phoneE164 = await decryptCampusAlertsPhone(s.phoneE164Encrypted);
      const isDnc = await alertsStore.isDnc(agencyId, phoneE164).catch(() => false);
      if (isDnc) continue;
      const claimed = await repo.putDeliveryOnce({
        pk: CAMPUS_ALERTS_KEYS.agencyPk(agencyId),
        sk: CAMPUS_ALERTS_KEYS.deliverySk(broadcastId, s.subscriptionId, "sms"),
        entityType: "CASUB_DELIVERY",
        agencyId,
        broadcastId,
        subscriptionId: s.subscriptionId,
        channel: "sms",
        status: "queued",
        createdAt: nowIso(),
        ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 3600,
      });
      if (!claimed) continue;
      out.push({ subscriptionId: s.subscriptionId, phoneE164 });
    }
    return out;
  }

  /** Count eligible without claiming delivery jobs (preview). */
  private async countEligible(agencyId: string): Promise<number> {
    const items = await repo.listSubscriptions(agencyId);
    let n = 0;
    for (const s of items) {
      if (!isBroadcastEligible(s)) continue;
      const phoneE164 = await decryptCampusAlertsPhone(s.phoneE164Encrypted);
      const isDnc = await alertsStore.isDnc(agencyId, phoneE164).catch(() => false);
      if (isDnc) continue;
      n += 1;
    }
    return n;
  }

  private assertEmergencyOperator(user: UserContext, alertsCfg: CampusAlertsConfig): void {
    if (!canInitiateCampusAlertsEmergencySms(user.role)) {
      fail("FORBIDDEN:Unauthorized to initiate emergency mass SMS", 403);
    }
    if (alertsCfg.emergencyMassSmsEnabled === false) {
      fail("VALIDATION:Emergency mass SMS is disabled for this university", 403);
    }
  }

  async previewEmergencyBroadcast(
    campusCode: string,
    user: UserContext,
    rawBody: unknown,
  ): Promise<CampusAlertsEmergencyPreview> {
    assertPlatformEnabled();
    void campusCode;
    const agencyId = user.agencyId;
    if (!agencyId) fail("FORBIDDEN", 403);
    const { alertsCfg, universityName } = await resolveCampusAgency(agencyId);
    this.assertEmergencyOperator(user, alertsCfg);

    const body = previewEmergencyBroadcastBodySchema.parse(rawBody);
    if (!isCampusAlertsMassSmsClassification(body.classification)) {
      fail(
        "VALIDATION:Mass SMS is reserved for qualifying campus emergencies. Annual renewal and routine notices must use email, portal, or campus communications — not mass SMS.",
        403,
      );
    }
    if (body.classification === "ALL_CLEAR" && alertsCfg.allClearMassSmsEnabled === false) {
      fail("VALIDATION:ALL_CLEAR mass SMS is disabled for this university", 403);
    }

    const recipientCount = await this.countEligible(agencyId);
    const costParts = estimateEmergencyBroadcastCost({
      messageBody: body.messageBody,
      recipientCount,
      ratePerSegmentUsd: alertsCfg.estimatedRatePerSegmentUsd,
    });
    const previewId = makeId("caprev");
    const now = nowIso();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const affectedAreasLabel =
      body.affectedAreasLabel?.trim() ||
      (body.targetSiteCodes?.length ? body.targetSiteCodes.join(", ") : "All campuses");

    const item: CampusAlertPreviewItem = {
      pk: CAMPUS_ALERTS_KEYS.agencyPk(agencyId),
      sk: CAMPUS_ALERTS_KEYS.previewSk(previewId),
      entityType: "CASUB_PREVIEW",
      previewId,
      agencyId,
      classification: body.classification,
      messageBody: body.messageBody,
      affectedAreasLabel,
      recipientCount,
      estimatedSegments: costParts.estimatedSegments,
      segmentsPerMessage: costParts.segmentsPerMessage,
      encoding: costParts.encoding,
      estimatedRatePerSegmentUsd: alertsCfg.estimatedRatePerSegmentUsd,
      estimatedTotalCostUsd: costParts.estimatedTotalCostUsd,
      initiatedBy: user.userId,
      createdAt: now,
      expiresAt,
      ttl: Math.floor(Date.now() / 1000) + 3600,
    };
    await repo.putPreview(item);

    return {
      previewId,
      universityName,
      authorizedSender: user.email || user.userId,
      classification: body.classification,
      affectedAreasLabel,
      messagePreview: body.messageBody,
      expiresAt,
      requireDualAuthorization: alertsCfg.requireDualAuthorization === true,
      cost: {
        recipientCount,
        segmentsPerMessage: costParts.segmentsPerMessage,
        estimatedSegments: costParts.estimatedSegments,
        estimatedRatePerSegmentUsd: alertsCfg.estimatedRatePerSegmentUsd,
        estimatedTotalCostUsd: costParts.estimatedTotalCostUsd,
        encoding: costParts.encoding,
        isEstimate: true,
        costAssumptions: alertsCfg.billingCostDisclaimer,
        contractualBillingMode: alertsCfg.contractualBillingMode,
      },
    };
  }

  async confirmEmergencyBroadcast(
    campusCode: string,
    user: UserContext,
    rawBody: unknown,
  ): Promise<{ campaignId: string; status: string; submitted: number; failed: number }> {
    assertPlatformEnabled();
    void campusCode;
    const agencyId = user.agencyId;
    if (!agencyId) fail("FORBIDDEN", 403);
    const { alertsCfg, universityName } = await resolveCampusAgency(agencyId);
    this.assertEmergencyOperator(user, alertsCfg);

    const body = confirmEmergencyBroadcastBodySchema.parse(rawBody);
    if (!isCampusAlertsMassSmsClassification(body.classification)) {
      fail("VALIDATION:Mass SMS is reserved for qualifying campus emergencies", 403);
    }

    const preview = await repo.getPreview(agencyId, body.previewId);
    if (!preview || preview.agencyId !== agencyId) fail("NOT_FOUND", 404);
    if (Date.parse(preview.expiresAt) < Date.now()) {
      fail("VALIDATION:Preview expired. Generate a new cost estimate before sending.", 400);
    }
    if (preview.classification !== body.classification || preview.messageBody !== body.messageBody) {
      fail("VALIDATION:Message or classification changed. Generate a new preview.", 400);
    }

    // Re-count — material audience/cost drift requires reconfirmation.
    const liveCount = await this.countEligible(agencyId);
    const liveCost = estimateEmergencyBroadcastCost({
      messageBody: body.messageBody,
      recipientCount: liveCount,
      ratePerSegmentUsd: alertsCfg.estimatedRatePerSegmentUsd,
    });
    if (
      liveCount !== body.expectedRecipientCount ||
      liveCost.estimatedSegments !== body.expectedEstimatedSegments ||
      liveCount !== preview.recipientCount ||
      liveCost.estimatedSegments !== preview.estimatedSegments
    ) {
      fail(
        "VALIDATION:Audience or estimated cost changed since preview. Please review the new estimate and confirm again.",
        409,
      );
    }

    if (alertsCfg.requireDualAuthorization) {
      if (!body.approvedByUserId || body.approvedByUserId === user.userId) {
        fail("VALIDATION:Dual authorization requires a distinct approver", 400);
      }
    }

    const campaignId = makeId("cacamp");
    const now = nowIso();
    const billingPeriod = now.slice(0, 7); // YYYY-MM
    const campaign: CampusAlertCampaignItem = {
      pk: CAMPUS_ALERTS_KEYS.agencyPk(agencyId),
      sk: CAMPUS_ALERTS_KEYS.campaignSk(campaignId),
      entityType: "CASUB_CAMPAIGN",
      campaignId,
      agencyId,
      emergencyClassification: body.classification,
      initiatedBy: user.userId,
      approvedBy: body.approvedByUserId,
      recipientCount: liveCount,
      estimatedSegments: liveCost.estimatedSegments,
      submittedSegments: 0,
      estimatedCostUsd: liveCost.estimatedTotalCostUsd,
      billingPeriod,
      contractualBillingMode: alertsCfg.contractualBillingMode,
      status: "queued",
      messageBody: body.messageBody,
      previewId: body.previewId,
      createdAt: now,
      confirmedAt: now,
      ttl: Math.floor(Date.now() / 1000) + 400 * 24 * 3600,
    };

    const created = await repo.putCampaign(campaign);
    if (!created) {
      fail("VALIDATION:Duplicate campaign request", 409);
    }

    const recipients = await this.collectEligibleRecipients(agencyId, campaignId);
    let submitted = 0;
    let failed = 0;
    const providerIds: string[] = [];
    const factory = await buildSmsFactoryEnvForAgency(agencyId);
    // Throughput: send sequentially with mock-friendly path; production should use SQS fan-out.
    for (const r of recipients) {
      try {
        const sms = await sendIncidentMediaLinkSms(factory, {
          toPhoneE164: r.phoneE164,
          messageBody: body.messageBody,
          agencyId,
          incidentId: `${campaignId}:${r.subscriptionId}`,
          messageType: "campus_alerts_emergency",
        });
        if (sms.status === "sent" || sms.status === "queued") {
          submitted += 1;
          if (sms.messageId) providerIds.push(sms.messageId);
        } else {
          failed += 1;
        }
      } catch {
        failed += 1;
      }
    }

    const status =
      failed === 0 && submitted > 0
        ? "submitted"
        : submitted === 0
          ? "failed"
          : "partial";

    await repo.saveCampaign({
      ...campaign,
      submittedSegments: submitted * liveCost.segmentsPerMessage,
      status,
      providerMessageIds: providerIds.slice(0, 50),
    });

    try {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.PUBLIC_REPORT_SUBMITTED,
        details: {
          source: "campus_alerts",
          action: "emergency_mass_sms",
          campaignId,
          classification: body.classification,
          universityName,
          recipientCount: liveCount,
          estimatedSegments: liveCost.estimatedSegments,
          estimatedCostUsd: liveCost.estimatedTotalCostUsd,
          submitted,
          failed,
          billingPeriod,
          contractualBillingMode: alertsCfg.contractualBillingMode,
        },
        createdAt: now,
        resourceType: "integration",
        resourceId: campaignId,
      });
    } catch {
      // non-fatal
    }

    return { campaignId, status, submitted, failed };
  }

  async listEmergencyUsage(
    campusCode: string,
    user: UserContext,
  ): Promise<{ universityName: string; items: CampusAlertsUsageRecordStaff[] }> {
    assertPlatformEnabled();
    void campusCode;
    const agencyId = user.agencyId;
    if (!agencyId) fail("FORBIDDEN", 403);
    const { universityName } = await resolveCampusAgency(agencyId);
    const campaigns = await repo.listCampaigns(agencyId);
    return {
      universityName,
      items: campaigns.map((c) => ({
        campaignId: c.campaignId,
        agencyId: c.agencyId,
        emergencyClassification: c.emergencyClassification,
        initiatedBy: c.initiatedBy,
        approvedBy: c.approvedBy,
        recipientCount: c.recipientCount,
        estimatedSegments: c.estimatedSegments,
        submittedSegments: c.submittedSegments,
        estimatedCostUsd: c.estimatedCostUsd,
        reconciledCostUsd: c.reconciledCostUsd,
        billingPeriod: c.billingPeriod,
        contractualBillingMode: c.contractualBillingMode,
        status: c.status,
        createdAt: c.createdAt,
        confirmedAt: c.confirmedAt,
      })),
    };
  }

  /**
   * Non-SMS annual renewal outreach materials for university communications.
   * Does not send SMS.
   */
  async renewalOutreachPack(
    campusCode: string,
    user: UserContext,
  ): Promise<{
    universityName: string;
    renewalsDue30: number;
    emailTemplate: string;
    newsletterCopy: string;
    instructorAnnouncement: string;
    portalBanner: string;
    qrNfcReminder: string;
  }> {
    assertPlatformEnabled();
    void campusCode;
    const agencyId = user.agencyId;
    if (!agencyId) fail("FORBIDDEN", 403);
    const { universityName } = await resolveCampusAgency(agencyId);
    const metrics = await this.staffMetrics(campusCode, user);
    return {
      universityName,
      renewalsDue30: metrics.totals.renewalDue30,
      emailTemplate: `Subject: Please renew your ${universityName} Campus Alerts registration\n\nPlease scan any NexCort iQ QR code or tap an NFC safety sign on campus, open the Information tab, and select Register / Renew Notifications.\n\nIndividual SMS verification codes are used only when you choose to verify your number.`,
      newsletterCopy: `Keep your campus safety notifications current. Renew Campus Alerts via any campus QR/NFC safety sign — Information tab → Register / Renew Notifications.`,
      instructorAnnouncement: `Please remind students to renew optional Campus Alerts registrations by scanning a campus safety QR/NFC sign. Mass SMS is not used for renewal reminders.`,
      portalBanner: `Campus Alerts renewal: verify your phone via QR/NFC → Information → Register / Renew Notifications.`,
      qrNfcReminder: `You're already registered. Verify and renew to keep your information current.`,
    };
  }
}
