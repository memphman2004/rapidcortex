"""Synthetic-only readiness. Real footage is not required when variety passes."""

REQUIRED_CAMERA_ANGLES = 3
REQUIRED_LIGHTING_CONDITIONS = 3
REQUIRED_STILL_CLASSES = ("handgun_visible", "knife_visible")


def check_synthetic_variety(assets: list[dict]) -> tuple[bool, list[str], str | None]:
    if not assets:
        return False, ["The dataset has no assets. The variety check did not pass."], None
    summary: dict[str, dict[str, set[str]]] = {
        name: {"cameraAngles": set(), "lightingConditions": set()} for name in REQUIRED_STILL_CLASSES
    }
    for asset in assets:
        names = {label["className"] for label in asset.get("labels", [])}
        for name in names:
            if name not in summary:
                continue
            angle = str(asset.get("cameraAngle") or "").strip()
            lighting = str(asset.get("lightingCondition") or "").strip()
            if angle:
                summary[name]["cameraAngles"].add(angle)
            if lighting:
                summary[name]["lightingConditions"].add(lighting)
    failures: list[str] = []
    for name in REQUIRED_STILL_CLASSES:
        angles = summary[name]["cameraAngles"]
        lighting = summary[name]["lightingConditions"]
        if len(angles) < REQUIRED_CAMERA_ANGLES:
            failures.append(f"{name}: only {len(angles)} camera angle(s) — need {REQUIRED_CAMERA_ANGLES}")
        if len(lighting) < REQUIRED_LIGHTING_CONDITIONS:
            failures.append(f"{name}: only {len(lighting)} lighting condition(s) — need {REQUIRED_LIGHTING_CONDITIONS}")
    if failures:
        return False, failures, None
    first_party = sum(1 for asset in assets if asset.get("source") == "FIRST_PARTY")
    bypass = "SYNTHETIC_ONLY_BYPASS" if first_party == 0 else None
    return True, [], bypass
