"""One Rekognition Custom Labels manifest line. Boxes are normalized 0–1."""

import json
from datetime import datetime, timezone

from rekognition_schema import CLASS_MAP, validate_class_name

MANIFEST_ATTRIBUTE = "nexcortiq-public-safety-detection"


def build_manifest_line(asset: dict, image_size: tuple[int, int] = (1024, 1024)) -> dict:
    width, height = image_size
    annotations = []
    objects = []
    for label in asset.get("labels", []):
        class_id = validate_class_name(label["className"])
        box = label["boundingBox"]
        annotations.append(
            {
                "class_id": class_id,
                "top": int(round(float(box["top"]) * height)),
                "left": int(round(float(box["left"]) * width)),
                "width": int(round(float(box["width"]) * width)),
                "height": int(round(float(box["height"]) * height)),
            }
        )
        objects.append({"confidence": 1})
    if not annotations:
        raise ValueError(f"Asset {asset.get('assetId')} has no labels.")
    created = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    return {
        "source-ref": asset["s3Uri"],
        MANIFEST_ATTRIBUTE: {
            "annotations": annotations,
            "image_size": [{"width": width, "height": height, "depth": 3}],
        },
        f"{MANIFEST_ATTRIBUTE}-metadata": {
            "objects": objects,
            "class-map": {str(index): name for name, index in CLASS_MAP.items()},
            "type": "groundtruth/object-detection",
            "human-annotated": "yes",
            "creation-date": created,
            "job-name": "nexcortiq-vision-labeling",
        },
    }


def manifest_document(lines: list[dict]) -> str:
    return "\n".join(json.dumps(line, separators=(",", ":")) for line in lines)


def split_train_validation(assets: list[dict], train_ratio: float = 0.85) -> tuple[list[dict], list[dict]]:
    if not assets:
        raise ValueError("No approved training assets found.")
    if not 0 < train_ratio < 1:
        raise ValueError("train ratio must be between 0 and 1.")
    ordered = sorted(assets, key=lambda item: item["assetId"])
    # Stable split so a test can assert the same rows. Shuffle is not used.
    split_at = max(1, min(len(ordered) - 1, int(len(ordered) * train_ratio))) if len(ordered) > 1 else 1
    if len(ordered) == 1:
        return ordered, []
    return ordered[:split_at], ordered[split_at:]
