#!/usr/bin/env python3
"""
patch-datalayer-template-workaround.py

Transforms infra/nested/stack-data-layer.yaml so that the 16 pre-existing
resources are referenced by parameter instead of created by CloudFormation.

WHY THIS EXISTS
  CloudFormation can't IMPORT the 16 resources because the nested DataLayer
  stack's Outputs reference conditional Secrets (MultilingualAzureApiKeysSecret
  / MultilingualGoogleServiceAccountSecret) that were never created. Adding
  those secrets to the IMPORT manifest fixes the Outputs check but triggers
  "modified resources not being imported" on the 55 existing tables.
  This Catch-22 has no clean IMPORT resolution without a nuclear rebuild.

WHAT THIS SCRIPT DOES
  For each of the 16 orphaned resources:
    1. Adds an ExistingXxx parameter with the known physical name/ARN as default.
    2. Removes the resource definition block.
    3. Replaces all Ref/GetAtt/DependsOn references to the removed resource
       throughout the template (Parameters, Outputs, other Resources, etc.).

  Ref replacements   → ExistingXxx parameter ref (same string value)
  GetAtt .Arn        → Fn::Sub ARN construction using the parameter
  GetAtt .StreamArn  → same pattern (DynamoDB streams)
  DependsOn entries  → removed

OUTPUT
  infra/nested/stack-data-layer.yaml          — replaced with JSON (CFN accepts
                                                JSON with .yaml extension)
  infra/nested/stack-data-layer.yaml.original — original backup

REVERSIBILITY
  cp infra/nested/stack-data-layer.yaml.original infra/nested/stack-data-layer.yaml

USAGE
  python3 scripts/patch-datalayer-template-workaround.py [dev|staging|prod]

  After running: bash scripts/deploy.sh dev
"""

from __future__ import annotations

import copy
import json
import os
import shutil
import sys

import yaml

STAGE = sys.argv[1] if len(sys.argv) > 1 else "dev"
ACCOUNT_ID = "158961537080"

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TEMPLATE_PATH = os.path.join(ROOT, "infra", "nested", "stack-data-layer.yaml")

CFN_TAG_MAP = {
    "Ref": "Ref",
    "Condition": "Condition",
    "Sub": "Fn::Sub",
    "If": "Fn::If",
    "And": "Fn::And",
    "Or": "Fn::Or",
    "Not": "Fn::Not",
    "Equals": "Fn::Equals",
    "Select": "Fn::Select",
    "Split": "Fn::Split",
    "Join": "Fn::Join",
    "FindInMap": "Fn::FindInMap",
    "Base64": "Fn::Base64",
    "Cidr": "Fn::Cidr",
    "ImportValue": "Fn::ImportValue",
    "Transform": "Fn::Transform",
    "Length": "Fn::Length",
    "ToJsonString": "Fn::ToJsonString",
}


class CfnLoader(yaml.SafeLoader):
    pass


def _getatt(loader, node):
    if isinstance(node, yaml.ScalarNode):
        val = loader.construct_scalar(node)
        return {"Fn::GetAtt": val.split(".", 1)}
    return {"Fn::GetAtt": loader.construct_sequence(node, deep=True)}


CfnLoader.add_constructor("!GetAtt", _getatt)


def _make_c(fn_key):
    def _c(loader, node):
        if isinstance(node, yaml.ScalarNode):
            return {fn_key: loader.construct_scalar(node)}
        if isinstance(node, yaml.SequenceNode):
            return {fn_key: loader.construct_sequence(node, deep=True)}
        return {fn_key: loader.construct_mapping(node, deep=True)}

    return _c


for _tag, _fn in CFN_TAG_MAP.items():
    CfnLoader.add_constructor(f"!{_tag}", _make_c(_fn))


def _fallback(loader, tag_suffix, node):
    if isinstance(node, yaml.SequenceNode):
        return loader.construct_sequence(node, deep=True)
    if isinstance(node, yaml.MappingNode):
        return loader.construct_mapping(node, deep=True)
    return loader.construct_scalar(node)


CfnLoader.add_multi_constructor("", _fallback)

# LogicalId → (parameter_name, physical_default, resource_category)
ORPHANED = {
    "QRLocationsTable": (
        "ExistingQRLocationsTableName",
        f"rapid-cortex-qr-locations-{STAGE}",
        "table",
    ),
    "CampusConfigTable": (
        "ExistingCampusConfigTableName",
        f"rapid-cortex-campus-config-{STAGE}",
        "table",
    ),
    "CampusIncidentsTable": (
        "ExistingCampusIncidentsTableName",
        f"rapid-cortex-campus-incidents-{STAGE}",
        "table",
    ),
    "VenueConfigTable": (
        "ExistingVenueConfigTableName",
        f"rapid-cortex-venue-config-{STAGE}",
        "table",
    ),
    "VenueAssetsTable": (
        "ExistingVenueAssetsTableName",
        f"rapid-cortex-venue-assets-{STAGE}",
        "table",
    ),
    "VenueFacilitiesTable": (
        "ExistingVenueFacilitiesTableName",
        f"rapid-cortex-venue-facilities-{STAGE}",
        "table",
    ),
    "ConnectRegistryTable": (
        "ExistingConnectRegistryTableName",
        f"rapid-cortex-connect-registry-{STAGE}",
        "table",
    ),
    "ConnectEvidenceTable": (
        "ExistingConnectEvidenceTableName",
        f"rapid-cortex-connect-evidence-{STAGE}",
        "table",
    ),
    "ConnectAccessSessionsTable": (
        "ExistingConnectAccessSessionsTableName",
        f"rapid-cortex-connect-sessions-{STAGE}",
        "table",
    ),
    "ConnectAccessLogTable": (
        "ExistingConnectAccessLogTableName",
        f"rapid-cortex-connect-access-log-{STAGE}",
        "table",
    ),
    "PlatformNoticesTable": (
        "ExistingPlatformNoticesTableName",
        f"rapid-cortex-platform-notices-{STAGE}",
        "table",
    ),
    "PlatformNoticeAcksTable": (
        "ExistingPlatformNoticeAcksTableName",
        f"rapid-cortex-platform-notice-acks-{STAGE}",
        "table",
    ),
    "VenueCameraAccessLogTable": (
        "ExistingVenueCameraAccessLogTableName",
        f"rapid-cortex-venue-camera-access-log-{STAGE}",
        "table",
    ),
    "VenueIncidentOverlaysTable": (
        "ExistingVenueIncidentOverlaysTableName",
        f"rapid-cortex-venue-incident-overlays-{STAGE}",
        "table",
    ),
    "VenueAssetsBucket": (
        "ExistingVenueAssetsBucketName",
        f"rapid-cortex-venue-assets-{STAGE}-{ACCOUNT_ID}",
        "bucket",
    ),
    "RingCredentialsSecret": (
        "ExistingRingCredentialsSecretArn",
        f"arn:aws:secretsmanager:us-east-1:{ACCOUNT_ID}:secret:rapid-cortex/connect/ring-credentials",
        "secret",
    ),
}


def _table_arn_sub(param_name: str) -> dict:
    return {
        "Fn::Sub": f"arn:aws:dynamodb:${{AWS::Region}}:${{AWS::AccountId}}:table/${{{param_name}}}"
    }


def _table_stream_arn_sub(param_name: str) -> dict:
    return {
        "Fn::Sub": f"arn:aws:dynamodb:${{AWS::Region}}:${{AWS::AccountId}}:table/${{{param_name}}}/stream/*"
    }


def _bucket_arn_sub(param_name: str) -> dict:
    return {"Fn::Sub": f"arn:aws:s3:::${{{param_name}}}"}


def _secret_arn_sub(param_name: str) -> dict:
    return {
        "Fn::Sub": f"arn:aws:secretsmanager:${{AWS::Region}}:${{AWS::AccountId}}:secret:${{{param_name}}}-*"
    }


def getatt_replacement(logical_id: str, attribute: str, param_name: str, category: str) -> dict:
    attr_lower = attribute.lower()
    if category == "table":
        if attr_lower == "arn":
            return _table_arn_sub(param_name)
        if "stream" in attr_lower:
            return _table_stream_arn_sub(param_name)
    elif category == "bucket":
        if attr_lower == "arn":
            return _bucket_arn_sub(param_name)
        if "domainname" in attr_lower or "regionaldomainname" in attr_lower:
            return {"Fn::Sub": f"${{{param_name}}}.s3.${{AWS::Region}}.amazonaws.com"}
        if "websiteurl" in attr_lower:
            return {
                "Fn::Sub": f"http://${{{param_name}}}.s3-website.${{AWS::Region}}.amazonaws.com"
            }
    elif category == "secret":
        if attr_lower == "arn":
            if param_name.endswith("Arn"):
                return {"Ref": param_name}
            return _secret_arn_sub(param_name)
    print(
        f"  WARN  Fn::GetAtt [{logical_id}, {attribute}] — no known replacement, using Ref fallback",
        file=sys.stderr,
    )
    return {"Ref": param_name}


def _filter_depends_on(value, logical_id: str):
    if isinstance(value, str):
        return None if value == logical_id else value
    if isinstance(value, list):
        filtered = [x for x in value if x != logical_id]
        return filtered if filtered else None
    return value


def replace_refs(node, logical_id: str, param_name: str, category: str):
    if isinstance(node, dict):
        if list(node.keys()) == ["Ref"] and node["Ref"] == logical_id:
            return {"Ref": param_name}

        if "Fn::GetAtt" in node:
            ga = node["Fn::GetAtt"]
            if isinstance(ga, list) and len(ga) == 2 and ga[0] == logical_id:
                return getatt_replacement(logical_id, ga[1], param_name, category)
            if isinstance(ga, str) and ga.startswith(f"{logical_id}."):
                attr = ga.split(".", 1)[1]
                return getatt_replacement(logical_id, attr, param_name, category)

        result = {}
        for k, v in node.items():
            if k == "DependsOn":
                new_dep = _filter_depends_on(v, logical_id)
                if new_dep:
                    result[k] = new_dep
            else:
                result[k] = replace_refs(v, logical_id, param_name, category)
        return result

    if isinstance(node, list):
        return [replace_refs(item, logical_id, param_name, category) for item in node]

    return node


def transform(template: dict) -> dict:
    t = copy.deepcopy(template)
    t.setdefault("Parameters", {})

    removed, not_found = [], []

    for logical_id, (param_name, default_value, category) in ORPHANED.items():
        if logical_id not in t.get("Resources", {}):
            not_found.append(logical_id)
            print(
                f"  skip  {logical_id} — not in template (already removed or never present)",
                file=sys.stderr,
            )
            continue

        if param_name in t["Parameters"]:
            t["Parameters"][param_name]["Default"] = default_value
            print(
                f"  param {param_name} — updated default (existing parameter)",
                file=sys.stderr,
            )
        else:
            t["Parameters"][param_name] = {
                "Type": "String",
                "Default": default_value,
                "Description": (
                    f"Pre-existing {category}: {logical_id} "
                    f"(managed outside CloudFormation for {STAGE})"
                ),
            }

        del t["Resources"][logical_id]

        for section in ("Resources", "Outputs", "Conditions", "Mappings", "Metadata", "Rules"):
            if section in t:
                t[section] = replace_refs(t[section], logical_id, param_name, category)

        removed.append(logical_id)
        print(
            f"  done  {logical_id} → parameter {param_name} (default: {default_value})",
            file=sys.stderr,
        )

    print(f"\nRemoved {len(removed)} resource(s), skipped {len(not_found)}", file=sys.stderr)
    if not_found:
        print(f"  Skipped (not in template): {not_found}", file=sys.stderr)

    return t


def main() -> int:
    if not os.path.exists(TEMPLATE_PATH):
        print(f"ERROR: template not found: {TEMPLATE_PATH}", file=sys.stderr)
        return 1

    print(f"=== DataLayer template workaround patch (stage={STAGE}) ===\n", file=sys.stderr)
    print(f"Source: {TEMPLATE_PATH}", file=sys.stderr)

    with open(TEMPLATE_PATH) as f:
        template = yaml.load(f, Loader=CfnLoader)

    before_count = len(template.get("Resources", {}))
    before_params = len(template.get("Parameters", {}))
    print(f"Before: {before_count} resources, {before_params} parameters\n", file=sys.stderr)

    patched = transform(template)

    after_count = len(patched.get("Resources", {}))
    after_params = len(patched.get("Parameters", {}))
    print(f"\nAfter : {after_count} resources, {after_params} parameters", file=sys.stderr)

    backup_path = TEMPLATE_PATH + ".original"
    if not os.path.exists(backup_path):
        shutil.copy2(TEMPLATE_PATH, backup_path)
        print(f"Backup: {backup_path}", file=sys.stderr)
    else:
        print(f"Backup already exists: {backup_path} (not overwritten)", file=sys.stderr)

    with open(TEMPLATE_PATH, "w") as f:
        json.dump(patched, f, indent=2)
        f.write("\n")

    print(f"\nWrote patched template: {TEMPLATE_PATH}", file=sys.stderr)
    print("\nNext steps:", file=sys.stderr)
    print("  source scripts/env-api-dev.sh && bash scripts/deploy.sh dev", file=sys.stderr)
    print("\nTo revert:", file=sys.stderr)
    print(f"  cp {backup_path} {TEMPLATE_PATH}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
