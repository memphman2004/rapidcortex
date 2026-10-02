import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { saveEmergencyContactsPayloadSchema } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import {
  badRequest,
  badRequestFromZod,
  notFound,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { makeId } from "../../lib/ids.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { gateSafeSound, httpMethod, mobileError, mobileOk, parseJsonBody } from "./shared.js";
import { putContacts } from "./store.js";

const auditRepo = new AuditRepository();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const gate = gateSafeSound(event);
    if (gate) return gate;

    const user = await getUserContext(event);
    if (!user) return mobileError(event, unauthorized());
    if (!isUserAccountActive(user)) return mobileError(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));

    const method = httpMethod(event);
    const path = event.rawPath ?? "";
    const agencyId = user.agencyId;

    if (method === "POST" && path === "/api/safe-sound/emergency-contacts") {
      const body = parseJsonBody(event);
      if (body === null) return mobileError(event, badRequest("Invalid JSON"));
      const parsed = saveEmergencyContactsPayloadSchema.safeParse(body);
      if (!parsed.success) return mobileError(event, badRequestFromZod(parsed.error));

      const contacts = parsed.data.contacts.map((c) => ({
        contactId: c.contactId ?? makeId("ct"),
        ownerId: user.userId,
        name: c.name,
        phone: c.phone,
        relationship: c.relationship,
        notifyViaPush: c.notifyViaPush,
        notifyViaSMS: c.notifyViaSMS,
        notifyViaCall: c.notifyViaCall,
        canCancelAlert: c.canCancelAlert,
        preferredLanguage: c.preferredLanguage ?? null,
        preferredLanguageName: c.preferredLanguageName ?? null,
        preferredLanguageRTL: c.preferredLanguageRTL ?? false,
      }));

      const saved = await putContacts(agencyId, user.userId, contacts);
      const now = new Date().toISOString();
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.SAFE_SOUND_CONTACTS_SAVED,
        details: { count: saved.length },
        createdAt: now,
        resourceType: "user",
        resourceId: user.userId,
      });
      return mobileOk(event, { contacts: saved });
    }

    return mobileError(event, notFound());
  } catch (e) {
    console.error("safe-sound contactsHttp", e);
    return mobileError(event, serverError());
  }
};
