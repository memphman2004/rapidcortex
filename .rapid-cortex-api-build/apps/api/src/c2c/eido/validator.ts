import { z } from "zod";
import { isValidIncidentTypeCode } from "../common-codes/incident-types.js";
import { err, ok, type EidoEnvelope, type Result, type ValidationError } from "./types.js";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const UNIT_ID = /^[A-Z0-9\-]{1,20}$/;
const E164 = /^\+[1-9]\d{6,14}$/;

function fieldError(field: string, message: string, code: ValidationError["code"]): ValidationError {
  return { field, message, code };
}

const coordinatesSchema = z.object({
  Latitude: z.number().min(-90).max(90),
  Longitude: z.number().min(-180).max(180),
  Altitude: z.number().optional(),
  AccuracyMeters: z.number().nonnegative().optional(),
  DeterminationMethod: z.enum(["GPS", "CELL", "WIFI", "ADDRESS", "MANUAL", "ALI"]).optional(),
});

const addressSchema = z.object({
  FullAddress: z.string().min(1),
  Number: z.string().optional(),
  PreDirectional: z.string().optional(),
  StreetName: z.string().min(1),
  StreetType: z.string().optional(),
  PostDirectional: z.string().optional(),
  Unit: z.string().optional(),
  City: z.string().min(1),
  State: z.string().length(2),
  PostalCode: z.string().optional(),
  County: z.string().optional(),
  Country: z.string().optional(),
  CrossStreet: z.string().optional(),
  IntersectionType: z.string().optional(),
  CommonPlaceName: z.string().optional(),
  MilePost: z.string().optional(),
});

export function validateEido(obj: unknown): Result<EidoEnvelope, ValidationError[]> {
  const errors: ValidationError[] = [];
  if (!obj || typeof obj !== "object") {
    return err([{ field: "$", message: "EIDO envelope must be an object", code: "REQUIRED" }]);
  }
  const raw = obj as Record<string, unknown>;
  const header = raw.header as Record<string, unknown> | undefined;
  const incident = raw.incident as Record<string, unknown> | undefined;

  if (!header || typeof header !== "object") {
    errors.push(fieldError("header", "header is required", "REQUIRED"));
  } else {
    if (typeof header.MessageId !== "string" || !UUID_V4.test(header.MessageId)) {
      errors.push(fieldError("header.MessageId", "must be UUID v4", "INVALID_FORMAT"));
    }
    if (typeof header.DateTimeSent !== "string" || !ISO_8601.test(header.DateTimeSent)) {
      errors.push(fieldError("header.DateTimeSent", "must be ISO 8601 with timezone", "REQUIRED"));
    }
    if (typeof header.SenderAgencyId !== "string" || !header.SenderAgencyId.trim()) {
      errors.push(fieldError("header.SenderAgencyId", "required", "REQUIRED"));
    }
    if (typeof header.SenderAgencyName !== "string" || !header.SenderAgencyName.trim()) {
      errors.push(fieldError("header.SenderAgencyName", "required", "REQUIRED"));
    }
    if (header.RecipientAgencyId !== "*" && typeof header.RecipientAgencyId !== "string") {
      errors.push(fieldError("header.RecipientAgencyId", "must be agency id or '*'", "INVALID_FORMAT"));
    }
    if (header.SchemaVersion !== "APCO-NENA-2.105.1-2017") {
      errors.push(fieldError("header.SchemaVersion", "must be APCO-NENA-2.105.1-2017", "INVALID_FORMAT"));
    }
    if (typeof header.MessageType !== "string") {
      errors.push(fieldError("header.MessageType", "required", "REQUIRED"));
    }
  }

  if (!incident || typeof incident !== "object") {
    errors.push(fieldError("incident", "incident is required", "REQUIRED"));
  } else {
    if (typeof incident.IncidentId !== "string" || !incident.IncidentId.trim()) {
      errors.push(fieldError("incident.IncidentId", "required", "REQUIRED"));
    }
    if (typeof incident.CallType !== "string" || !isValidIncidentTypeCode(incident.CallType)) {
      errors.push(
        fieldError(
          "incident.CallType",
          "must be an APCO incident type or agency-extended X- code",
          "UNKNOWN_CODE",
        ),
      );
    }
    if (typeof incident.CallTypeDescription !== "string" || !incident.CallTypeDescription.trim()) {
      errors.push(fieldError("incident.CallTypeDescription", "required", "REQUIRED"));
    }
    if (!["1", "2", "3", "4", "5"].includes(String(incident.Priority))) {
      errors.push(fieldError("incident.Priority", "must be 1-5", "OUT_OF_RANGE"));
    }
    const statuses = ["PENDING", "DISPATCHED", "ACTIVE", "ON_SCENE", "CLEARED", "CANCELLED", "DUPLICATE", "TRANSFERRED"];
    if (!statuses.includes(String(incident.Status))) {
      errors.push(fieldError("incident.Status", "invalid incident status", "UNKNOWN_CODE"));
    }
    if (typeof incident.ReceivedAt !== "string" || !ISO_8601.test(incident.ReceivedAt)) {
      errors.push(fieldError("incident.ReceivedAt", "must be ISO 8601", "INVALID_FORMAT"));
    }
    if (typeof incident.UpdatedAt !== "string" || !ISO_8601.test(incident.UpdatedAt)) {
      errors.push(fieldError("incident.UpdatedAt", "must be ISO 8601", "INVALID_FORMAT"));
    }

    const location = incident.Location as Record<string, unknown> | undefined;
    if (!location || typeof location !== "object") {
      errors.push(fieldError("incident.Location", "required", "REQUIRED"));
    } else {
      const address = addressSchema.safeParse(location.Address);
      if (!address.success) {
        errors.push(fieldError("incident.Location.Address", "invalid address", "INVALID_FORMAT"));
      }
      if (location.Coordinates !== undefined) {
        const coords = coordinatesSchema.safeParse(location.Coordinates);
        if (!coords.success) {
          errors.push(fieldError("incident.Location.Coordinates", "WGS84 lat/lon out of range", "OUT_OF_RANGE"));
        }
      } else if (header?.MessageType === "NEW_INCIDENT") {
        errors.push(
          fieldError(
            "incident.Location.Coordinates",
            "WGS84 coordinates required for dispatch forwarding",
            "BUSINESS_RULE",
          ),
        );
      }
    }

    if (incident.Caller && typeof incident.Caller === "object") {
      const caller = incident.Caller as Record<string, unknown>;
      if (caller.CallbackNumber && (typeof caller.CallbackNumber !== "string" || !E164.test(caller.CallbackNumber))) {
        errors.push(fieldError("incident.Caller.CallbackNumber", "must be E.164", "INVALID_FORMAT"));
      }
    }

    if (Array.isArray(incident.Units)) {
      incident.Units.forEach((unit, i) => {
        if (!unit || typeof unit !== "object") return;
        const u = unit as Record<string, unknown>;
        if (typeof u.UnitId !== "string" || !UNIT_ID.test(u.UnitId)) {
          errors.push(fieldError(`incident.Units[${i}].UnitId`, "must match [A-Z0-9-]{1,20}", "INVALID_FORMAT"));
        }
      });
    }
  }

  if (errors.length) return err(errors);
  return ok(obj as EidoEnvelope);
}

export { UUID_V4, ISO_8601, UNIT_ID };
