#!/usr/bin/env python3
"""Create empty per-stage clones of DataLayer 'Existing*' tables and buckets.

DataLayer does not create these resources; it only takes their names as parameters.
Defaults in stack-data-layer.yaml are the live `-dev` names. Staging (engineering)
must have its own empty tables/buckets before `deploy.sh staging`, or Lambdas would
read/write production Rapid IQ, campus, venue, RCS, and marketing data.

Copies schema only (key schema, GSIs, streams, SSE, TTL). Never copies items.
Refuses target stage `dev` and any destination whose name equals the source.
"""
from __future__ import annotations

import argparse
import sys
import time
from typing import Any

import boto3
from botocore.exceptions import ClientError

PREFIX = "rapid-cortex"

# Physical names DataLayer consumes via Existing* parameters (plus conferences,
# which Rapid IQ references as ${prefix}-conferences-${stage} outside DataLayer).
ORPHAN_TABLE_SLUGS = [
    "qr-locations",
    "campus-config",
    "campus-incidents",
    "venue-config",
    "campus-notification-log",
    "venue-notification-log",
    "venue-camera-registry",
    "campus-camera-registry",
    "venue-assets",
    "venue-facilities",
    "connect-registry",
    "connect-evidence",
    "connect-sessions",
    "connect-access-log",
    "platform-notices",
    "platform-notice-acks",
    "venue-camera-access-log",
    "venue-incident-overlays",
    "job-applications",
    "marketing-leads",
    "psap-prospects",
    "rapid-iq-opportunities",
    "rapid-iq-signals",
    "rapid-iq-pipeline-signals",
    "rapid-iq-contacts",
    "rapid-iq-sources",
    "rapid-iq-jurisdictions",
    "rapid-iq-state-coverage",
    "rcs-calls",
    "rcs-units",
    "rcs-escalation",
    "conferences",
]

ORPHAN_BUCKET_SLUGS = [
    "venue-assets",
    "resumes",
]

# Dashboard notification logs: HASH agencyId / RANGE notificationId (see venue-dashboard-service).
NOTIFICATION_LOG_FALLBACK: dict[str, Any] = {
    "AttributeDefinitions": [
        {"AttributeName": "agencyId", "AttributeType": "S"},
        {"AttributeName": "notificationId", "AttributeType": "S"},
    ],
    "KeySchema": [
        {"AttributeName": "agencyId", "KeyType": "HASH"},
        {"AttributeName": "notificationId", "KeyType": "RANGE"},
    ],
}
NOTIFICATION_LOG_SLUGS = {"venue-notification-log", "campus-notification-log"}

# Used only when the source conferences table does not exist yet.
CONFERENCES_FALLBACK: dict[str, Any] = {
    "AttributeDefinitions": [
        {"AttributeName": "conferenceId", "AttributeType": "S"},
        {"AttributeName": "agencyId", "AttributeType": "S"},
        {"AttributeName": "startDate", "AttributeType": "S"},
    ],
    "KeySchema": [{"AttributeName": "conferenceId", "KeyType": "HASH"}],
    "GlobalSecondaryIndexes": [
        {
            "IndexName": "agencyId-startDate-index",
            "KeySchema": [
                {"AttributeName": "agencyId", "KeyType": "HASH"},
                {"AttributeName": "startDate", "KeyType": "RANGE"},
            ],
            "Projection": {"ProjectionType": "ALL"},
        }
    ],
}


def table_name(slug: str, stage: str) -> str:
    return f"{PREFIX}-{slug}-{stage}"


def bucket_name(slug: str, stage: str, account: str) -> str:
    return f"{PREFIX}-{slug}-{stage}-{account}"


def gsi_create_entries(gsis: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for gsi in gsis or []:
        entry: dict[str, Any] = {
            "IndexName": gsi["IndexName"],
            "KeySchema": gsi["KeySchema"],
            "Projection": gsi["Projection"],
        }
        out.append(entry)
    return out


def lsi_create_entries(lsis: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for lsi in lsis or []:
        out.append(
            {
                "IndexName": lsi["IndexName"],
                "KeySchema": lsi["KeySchema"],
                "Projection": lsi["Projection"],
            }
        )
    return out


def create_params_from_description(dest: str, desc: dict[str, Any]) -> dict[str, Any]:
    params: dict[str, Any] = {
        "TableName": dest,
        "AttributeDefinitions": desc["AttributeDefinitions"],
        "KeySchema": desc["KeySchema"],
        "BillingMode": "PAY_PER_REQUEST",
    }
    gsis = gsi_create_entries(desc.get("GlobalSecondaryIndexes"))
    if gsis:
        params["GlobalSecondaryIndexes"] = gsis
    lsis = lsi_create_entries(desc.get("LocalSecondaryIndexes"))
    if lsis:
        params["LocalSecondaryIndexes"] = lsis
    stream = desc.get("StreamSpecification") or {}
    if stream.get("StreamEnabled"):
        params["StreamSpecification"] = {
            "StreamEnabled": True,
            "StreamViewType": stream.get("StreamViewType", "NEW_AND_OLD_IMAGES"),
        }
    sse = desc.get("SSEDescription") or {}
    if sse.get("Status") in ("ENABLED", "ENABLING"):
        params["SSESpecification"] = {"Enabled": True}
    return params


def wait_active(ddb: Any, name: str) -> None:
    waiter = ddb.get_waiter("table_exists")
    waiter.wait(TableName=name)
    for _ in range(60):
        status = ddb.describe_table(TableName=name)["Table"]["TableStatus"]
        if status == "ACTIVE":
            return
        time.sleep(2)
    raise RuntimeError(f"Table {name} did not become ACTIVE")


def ensure_table(
    ddb: Any,
    source: str,
    dest: str,
    slug: str,
    enable_pitr: bool,
    dry_run: bool,
) -> str:
    try:
        ddb.describe_table(TableName=dest)
        return f"exists {dest}"
    except ClientError as exc:
        if exc.response["Error"]["Code"] != "ResourceNotFoundException":
            raise

    desc: dict[str, Any] | None = None
    try:
        desc = ddb.describe_table(TableName=source)["Table"]
    except ClientError as exc:
        if exc.response["Error"]["Code"] != "ResourceNotFoundException":
            raise
        if slug in NOTIFICATION_LOG_SLUGS:
            desc = NOTIFICATION_LOG_FALLBACK
        elif slug != "conferences":
            return f"SKIP missing source {source}"
        else:
            desc = CONFERENCES_FALLBACK

    params = create_params_from_description(dest, desc)
    if dry_run:
        fallback_label = (
            "notification-log-fallback"
            if desc is NOTIFICATION_LOG_FALLBACK
            else "conferences-fallback"
            if desc is CONFERENCES_FALLBACK
            else source
        )
        return f"would-create {dest} from {fallback_label}"

    ddb.create_table(**params)
    wait_active(ddb, dest)

    ttl_src = None
    if source:
        try:
            ttl_src = ddb.describe_time_to_live(TableName=source)
        except ClientError:
            ttl_src = None
    ttl_spec = (ttl_src or {}).get("TimeToLiveDescription") or {}
    ttl_attr = (
        ttl_spec.get("AttributeName")
        if ttl_spec.get("TimeToLiveStatus") in ("ENABLED", "ENABLING")
        else None
    )
    if not ttl_attr and slug in NOTIFICATION_LOG_SLUGS:
        ttl_attr = "ttl"
    if ttl_attr:
        ddb.update_time_to_live(
            TableName=dest,
            TimeToLiveSpecification={"Enabled": True, "AttributeName": ttl_attr},
        )

    if enable_pitr:
        try:
            ddb.update_continuous_backups(
                TableName=dest,
                PointInTimeRecoverySpecification={"PointInTimeRecoveryEnabled": True},
            )
        except ClientError as exc:
            print(f"WARN: PITR not enabled on {dest}: {exc}", file=sys.stderr)

    return f"created {dest}"


def ensure_bucket(s3: Any, dest: str, region: str, dry_run: bool) -> str:
    try:
        s3.head_bucket(Bucket=dest)
        return f"exists s3://{dest}"
    except ClientError as exc:
        http = exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
        code = exc.response["Error"]["Code"]
        if http not in (404, 301) and code not in ("404", "NoSuchBucket", "NotFound"):
            raise
    if dry_run:
        return f"would-create s3://{dest}"
    kwargs: dict[str, Any] = {"Bucket": dest}
    if region != "us-east-1":
        kwargs["CreateBucketConfiguration"] = {"LocationConstraint": region}
    try:
        s3.create_bucket(**kwargs)
    except ClientError as exc:
        if exc.response["Error"]["Code"] != "BucketAlreadyOwnedByYou":
            raise
        return f"exists s3://{dest}"
    s3.put_bucket_encryption(
        Bucket=dest,
        ServerSideEncryptionConfiguration={
            "Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]
        },
    )
    s3.put_public_access_block(
        Bucket=dest,
        PublicAccessBlockConfiguration={
            "BlockPublicAcls": True,
            "IgnorePublicAcls": True,
            "BlockPublicPolicy": True,
            "RestrictPublicBuckets": True,
        },
    )
    return f"created s3://{dest}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target-stage", required=True)
    parser.add_argument("--source-stage", default="dev")
    parser.add_argument("--region", default="us-east-1")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--no-pitr", action="store_true")
    args = parser.parse_args()

    target = args.target_stage.strip().lower()
    source_stage = args.source_stage.strip().lower()
    if target in {"dev", "prod"}:
        print("ERROR: refusing to create orphan resources for target stage dev or prod.", file=sys.stderr)
        return 1
    if target == source_stage:
        print("ERROR: target stage must differ from source stage.", file=sys.stderr)
        return 1

    session = boto3.Session(region_name=args.region)
    sts = session.client("sts")
    account = sts.get_caller_identity()["Account"]
    ddb = session.client("dynamodb")
    s3 = session.client("s3")

    print(f"Account {account} region {args.region}: schema-only clone {source_stage} → {target}")
    failed = 0
    for slug in ORPHAN_TABLE_SLUGS:
        src = table_name(slug, source_stage)
        dest = table_name(slug, target)
        if dest == src:
            print(f"ERROR: source equals dest for {slug}", file=sys.stderr)
            failed += 1
            continue
        try:
            msg = ensure_table(
                ddb,
                src,
                dest,
                slug,
                enable_pitr=not args.no_pitr,
                dry_run=args.dry_run,
            )
            print(f"  table {slug}: {msg}")
        except Exception as exc:  # noqa: BLE001 — report and continue remaining slugs
            failed += 1
            print(f"  table {slug}: ERROR {exc}", file=sys.stderr)

    for slug in ORPHAN_BUCKET_SLUGS:
        dest = bucket_name(slug, target, account)
        src = bucket_name(slug, source_stage, account)
        if dest == src:
            print(f"ERROR: source bucket equals dest for {slug}", file=sys.stderr)
            failed += 1
            continue
        try:
            msg = ensure_bucket(s3, dest, args.region, args.dry_run)
            print(f"  bucket {slug}: {msg}")
        except Exception as exc:  # noqa: BLE001
            failed += 1
            print(f"  bucket {slug}: ERROR {exc}", file=sys.stderr)

    if failed:
        print(f"ERROR: {failed} resource(s) failed", file=sys.stderr)
        return 1
    print("OK: staging orphan tables/buckets are present (empty clones; live -dev data untouched).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
