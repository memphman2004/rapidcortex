import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "src"
for folder in (
    "manifest_compiler",
    "dataset_readiness",
    "first_party_importer",
    "pii_masking",
    "training_job_launcher",
):
    sys.path.insert(0, str(ROOT / folder))

from face_blurrer import mask_raw_object
from launcher import launch_training_job
from manifest_builder import build_manifest_line, manifest_document
from rekognition_schema import CLASS_MAP
from validation import authorize_ingest, lineage_ttl
from variety_checker import check_synthetic_variety


def _asset(asset_id: str, class_name: str, angle: str, lighting: str) -> dict:
    return {
        "assetId": asset_id,
        "s3Uri": f"s3://studio/synthetic/{asset_id}.png",
        "source": "SYNTHETIC",
        "cameraAngle": angle,
        "lightingCondition": lighting,
        "labels": [{"className": class_name, "boundingBox": {"top": 0.1, "left": 0.2, "width": 0.3, "height": 0.4}}],
    }


def _varied(class_name: str, prefix: str) -> list[dict]:
    angles = ("overhead", "doorway", "corridor")
    lighting = ("day", "night", "low")
    return [_asset(f"{prefix}-{index}", class_name, angles[index], lighting[index]) for index in range(3)]


def test_class_map_consistency():
    lines = [build_manifest_line(_asset(f"a{index}", name, "overhead", "day")) for index, name in enumerate(CLASS_MAP)]
    maps = [line["nexcortiq-public-safety-detection-metadata"]["class-map"] for line in lines]
    assert maps[0] == maps[-1]
    assert maps[0]["0"] == "handgun_visible"
    assert maps[0]["1"] == "knife_visible"
    ids = [line["nexcortiq-public-safety-detection"]["annotations"][0]["class_id"] for line in lines]
    assert ids == list(range(len(CLASS_MAP)))


def test_manifest_json_lines_format():
    document = manifest_document([build_manifest_line(_asset("one", "handgun_visible", "overhead", "day"))])
    parsed = json.loads(document)
    assert parsed["source-ref"].endswith("one.png")
    box = parsed["nexcortiq-public-safety-detection"]["annotations"][0]
    assert box["left"] == 205
    assert box["top"] == 102


def test_readiness_bypass_variety_pass():
    assets = _varied("handgun_visible", "f") + _varied("knife_visible", "b")
    passed, failures, bypass = check_synthetic_variety(assets)
    assert passed is True
    assert failures == []
    assert bypass == "SYNTHETIC_ONLY_BYPASS"


def test_readiness_bypass_variety_fail():
    assets = _varied("handgun_visible", "f") + _varied("knife_visible", "b")[:2]
    passed, failures, bypass = check_synthetic_variety(assets)
    assert passed is False
    assert bypass is None
    assert any("knife_visible: only 2 camera angle" in item for item in failures)


def test_readiness_blocks_zero_asset_dataset():
    passed, failures, _bypass = check_synthetic_variety([])
    assert passed is False
    assert failures[0].startswith("The dataset has no assets")


def test_pii_blur_deletes_raw():
    deleted = []
    stored = []

    class S3:
        def get_object(self, **_kwargs):
            return {"Body": _Body(b"raw-bytes")}

        def put_object(self, **kwargs):
            stored.append(kwargs["Key"])

        def delete_object(self, **kwargs):
            deleted.append(kwargs["Key"])

    class Rekognition:
        def detect_faces(self, **_kwargs):
            return {"FaceDetails": [{"Confidence": 99}]}

    result = mask_raw_object(
        s3=S3(),
        rekognition=Rekognition(),
        bucket="first-party",
        raw_key="raw/ing-1/clip.jpg",
        blur=lambda raw, faces: b"blurred",
    )
    assert deleted == ["raw/ing-1/clip.jpg"]
    assert stored == ["processed/ing-1/clip.jpg"]
    assert result["facesBlurred"] == 1
    assert len(result["originalHash"]) == 64


def test_dsa_required_for_first_party():
    agreements = {"dsa-1": {"agencyId": "agency-1", "status": "active"}}
    assert authorize_ingest({}, agreements)["statusCode"] == 403
    assert authorize_ingest({"dsaId": "missing", "agencyId": "agency-1"}, agreements)["statusCode"] == 403
    assert authorize_ingest({"dsaId": "dsa-1", "agencyId": "other"}, agreements)["statusCode"] == 403
    assert authorize_ingest({"dsaId": "dsa-1", "agencyId": "agency-1"}, agreements)["statusCode"] == 200


def test_training_launcher_writes_status_training():
    written = {}

    class Table:
        def put_item(self, Item):
            written.update(Item)

    class Rekognition:
        def create_project_version(self, **_kwargs):
            return {"ProjectVersionArn": "arn:aws:rekognition:us-east-1:158961537080:project/nexcortiq-public-safety-detection/version/v1/ABCDEF"}

    item = launch_training_job(
        dataset_version="v1",
        train_manifest_s3_uri="s3://studio/manifests/v1_train.manifest",
        validation_manifest_s3_uri="s3://studio/manifests/v1_validation.manifest",
        rekognition=Rekognition(),
        jobs_table=Table(),
        project_arn="arn:aws:rekognition:us-east-1:158961537080:project/nexcortiq-public-safety-detection/123",
        studio_bucket="studio",
    )
    assert item["status"] == "TRAINING"
    assert written["status"] == "TRAINING"
    assert item["rekognitionProjectVersionArn"].endswith("ABCDEF")


def test_slot_count_7year_ttl():
    now = 1_700_000_000
    assert lineage_ttl(now) - now == 7 * 365 * 24 * 60 * 60


class _Body:
    def __init__(self, payload: bytes):
        self.payload = payload

    def read(self) -> bytes:
        return self.payload
