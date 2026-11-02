"""A first-party upload needs an active data-sharing agreement for that agency."""

SEVEN_YEARS_SECONDS = 7 * 365 * 24 * 60 * 60


def lineage_ttl(now_epoch: int) -> int:
    return now_epoch + SEVEN_YEARS_SECONDS


def authorize_ingest(event: dict, agreements: dict) -> dict:
    dsa_id = str(event.get("dsaId") or "").strip()
    agency_id = str(event.get("agencyId") or "").strip()
    if not dsa_id or not agency_id:
        return {"statusCode": 403, "body": "No active Data Sharing Agreement on file."}
    agreement = agreements.get(dsa_id)
    if not agreement or agreement.get("agencyId") != agency_id or agreement.get("status") != "active":
        return {"statusCode": 403, "body": "No active Data Sharing Agreement on file."}
    return {"statusCode": 200, "dsaId": dsa_id, "agencyId": agency_id}
