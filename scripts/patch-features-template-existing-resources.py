#!/usr/bin/env python3
"""
Patch stack-app-sam-features.yaml so Retain leftovers (tables + S3 buckets) are
parameters instead of CREATE resources. SNS topics stay CREATE (deleted with stack).

Writes JSON (CFN-accepted) to --out. Does not modify the source template.

Usage:
  python3 scripts/patch-features-template-existing-resources.py \
    --stage dev --out /tmp/stack-app-sam-features.existing.yaml
"""

from __future__ import annotations

import argparse
import json
import os
import sys

import yaml

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "infra", "nested", "stack-app-sam-features.yaml")
ACCOUNT_ID = "158961537080"

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


# logical_id -> (param_name, physical_name_template, kind)
# kind: "table" | "bucket"
ORPHANS = {
    "CitizensTable": ("ExistingCitizensTableName", "rapid-cortex-citizens-{stage}", "table"),
    "AddressIntelTable": ("ExistingAddressIntelTableName", "rapid-cortex-address-intel-{stage}", "table"),
    "AltResponseTable": ("ExistingAltResponseTableName", "rapid-cortex-alt-response-{stage}", "table"),
    "CoRespondersTable": ("ExistingCoRespondersTableName", "rapid-cortex-co-responders-{stage}", "table"),
    "MutualAidTable": ("ExistingMutualAidTableName", "rapid-cortex-mutual-aid-{stage}", "table"),
    "MCITable": ("ExistingMCITableName", "rapid-cortex-mci-{stage}", "table"),
    "InfraTable": ("ExistingInfraTableName", "rapid-cortex-infrastructure-{stage}", "table"),
    "InterpreterTable": ("ExistingInterpreterTableName", "rapid-cortex-interpreter-{stage}", "table"),
    "EvidenceTable": ("ExistingEvidenceTableName", "rapid-cortex-evidence-{stage}", "table"),
    "AssessmentTable": ("ExistingAssessmentTableName", "rapid-cortex-assessment-{stage}", "table"),
    "LearningTable": ("ExistingLearningTableName", "rapid-cortex-learning-{stage}", "table"),
    "PublicEventsTable": ("ExistingPublicEventsTableName", "rapid-cortex-public-events-{stage}", "table"),
    "CheckinTable": ("ExistingCheckinTableName", "rapid-cortex-checkin-{stage}", "table"),
    "SocialSignalsTable": ("ExistingSocialSignalsTableName", "rapid-cortex-social-signals-{stage}", "table"),
    "AgencyAiGateTable": ("ExistingAgencyAiGateTableName", "rapid-cortex-agency-ai-gate-{stage}", "table"),
    "PrePlanBucket": ("ExistingPrePlanBucketName", "rapid-cortex-preplans-{stage}-{account}", "bucket"),
    "EvidenceBucket": ("ExistingEvidenceBucketName", "rapid-cortex-evidence-{stage}-{account}", "bucket"),
}


def walk_replace(node, stage: str):
    """Replace Ref/GetAtt to orphaned resources with Existing* params / ARN Subs."""
    if isinstance(node, dict):
        if set(node.keys()) == {"Ref"}:
            ref = node["Ref"]
            if ref in ORPHANS:
                return {"Ref": ORPHANS[ref][0]}
            return node
        if set(node.keys()) == {"Fn::GetAtt"}:
            ga = node["Fn::GetAtt"]
            if isinstance(ga, list) and len(ga) == 2:
                logical, attr = ga
                if logical in ORPHANS:
                    param, _, kind = ORPHANS[logical]
                    if attr == "Arn" and kind == "table":
                        return {
                            "Fn::Sub": (
                                f"arn:aws:dynamodb:${{AWS::Region}}:${{AWS::AccountId}}:table/${{{param}}}"
                            )
                        }
                    if attr == "Arn" and kind == "bucket":
                        return {"Fn::Sub": f"arn:aws:s3:::${{{param}}}"}
                    if attr == "StreamArn" and kind == "table":
                        # Stream ARN not known without lookup; Features IAM does not use streams.
                        raise SystemExit(f"Unsupported GetAtt {logical}.{attr}")
            return node
        # "${LogicalId.Arn}" / "${LogicalId.Arn}/index/*" inside Fn::Sub strings
        if "Fn::Sub" in node:
            sub = node["Fn::Sub"]
            if isinstance(sub, str):
                for logical, (param, _, kind) in ORPHANS.items():
                    if kind == "table":
                        sub = sub.replace(
                            f"${{{logical}.Arn}}",
                            f"arn:aws:dynamodb:${{AWS::Region}}:${{AWS::AccountId}}:table/${{{param}}}",
                        )
                    else:
                        sub = sub.replace(f"${{{logical}.Arn}}", f"arn:aws:s3:::${{{param}}}")
                        sub = sub.replace(f"${{{logical}}}", f"${{{param}}}")
                node = dict(node)
                node["Fn::Sub"] = sub
            elif isinstance(sub, list) and sub:
                # [template, {Var: ...}] form — walk vars + template
                tpl = sub[0]
                if isinstance(tpl, str):
                    for logical, (param, _, kind) in ORPHANS.items():
                        if kind == "table":
                            tpl = tpl.replace(
                                f"${{{logical}.Arn}}",
                                f"arn:aws:dynamodb:${{AWS::Region}}:${{AWS::AccountId}}:table/${{{param}}}",
                            )
                        else:
                            tpl = tpl.replace(f"${{{logical}.Arn}}", f"arn:aws:s3:::${{{param}}}")
                    vars_ = walk_replace(sub[1], stage) if len(sub) > 1 else {}
                    return {"Fn::Sub": [tpl, vars_] if len(sub) > 1 else tpl}
        return {k: walk_replace(v, stage) for k, v in node.items()}
    if isinstance(node, list):
        return [walk_replace(x, stage) for x in node]
    return node


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--stage", default="dev")
    ap.add_argument("--out", required=True)
    ap.add_argument("--account", default=ACCOUNT_ID)
    args = ap.parse_args()

    with open(SRC, encoding="utf-8") as f:
        tpl = yaml.load(f, Loader=CfnLoader)

    params = tpl.setdefault("Parameters", {})
    for logical, (param, name_tpl, kind) in ORPHANS.items():
        physical = name_tpl.format(stage=args.stage, account=args.account)
        params[param] = {
            "Type": "String",
            "Default": physical,
            "Description": f"Physical name of existing {logical} ({kind}); do not CREATE.",
        }

    resources = tpl["Resources"]
    for logical in ORPHANS:
        if logical not in resources:
            print(f"WARN: missing resource {logical}", file=sys.stderr)
            continue
        del resources[logical]
        print(f"removed CREATE for {logical} → use {ORPHANS[logical][0]}")

    # Drop DependsOn entries pointing at removed resources
    for _name, res in list(resources.items()):
        deps = res.get("DependsOn")
        if not deps:
            continue
        if isinstance(deps, str):
            if deps in ORPHANS:
                del res["DependsOn"]
        elif isinstance(deps, list):
            kept = [d for d in deps if d not in ORPHANS]
            if kept:
                res["DependsOn"] = kept
            else:
                del res["DependsOn"]

    tpl = walk_replace(tpl, args.stage)

    # Outputs that Ref removed buckets/tables
    outputs = tpl.get("Outputs") or {}
    for out_name, out_body in list(outputs.items()):
        val = out_body.get("Value")
        # already walked; drop outputs that still reference missing logicals via GetAtt
        dumped = json.dumps(val)
        bad = False
        for logical in ORPHANS:
            if f'"{logical}"' in dumped and "Existing" not in dumped:
                # still pointing at removed logical id somehow
                bad = True
        if bad:
            print(f"WARN: dropping output {out_name}", file=sys.stderr)
            del outputs[out_name]

    os.makedirs(os.path.dirname(os.path.abspath(args.out)) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(tpl, f, indent=2)
        f.write("\n")
    print(f"wrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
