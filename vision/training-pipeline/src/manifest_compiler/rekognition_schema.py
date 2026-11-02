"""Custom Labels class ids. Names match the studio review categories."""

CLASS_MAP = {
    "handgun_visible": 0,
    "knife_visible": 1,
    "physical_fight": 2,
    "person_fallen": 3,
    "nexcort-forced-entry": 4,
    "vehicle_collision": 5,
}

REQUIRED_STILL_CLASSES = ("handgun_visible", "knife_visible")


def validate_class_name(name: str) -> int:
    if name not in CLASS_MAP:
        raise ValueError(f"Unknown training class: {name}")
    return CLASS_MAP[name]
