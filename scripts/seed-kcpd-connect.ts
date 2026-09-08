/**
 * First-tenant wrapper. Prefer scripts/seed-call-assist-tenant.ts with AGENCY_ID.
 */
process.env.AGENCY_ID = process.env.AGENCY_ID || process.env.KCPD_AGENCY_ID || "kcpd";
process.env.CALL_ASSIST_TEST_DID = process.env.CALL_ASSIST_TEST_DID || process.env.KCPD_TEST_DID || "";
process.env.CALL_ASSIST_SEED_PROFILE = process.env.CALL_ASSIST_SEED_PROFILE || "kcpd";

await import("./seed-call-assist-tenant.ts");
