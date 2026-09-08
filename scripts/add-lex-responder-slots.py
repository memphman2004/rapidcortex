#!/usr/bin/env python3
"""Idempotently add responder intake slots (apt, cross streets, vehicle set) to bot-spec.json."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / "infra" / "lex" / "bot-spec.json"

APT = {
    "name": "AptBusiness",
    "slotType": "FreeText",
    "required": False,
    "promptEn": "Is there an apartment, suite, or unit number?",
    "promptEs": "¿Hay número de apartamento, suite o unidad?",
}
CROSS = {
    "name": "CrossStreets",
    "slotType": "FreeText",
    "required": False,
    "promptEn": "What are the nearest cross streets?",
    "promptEs": "¿Cuáles son las calles transversales más cercanas?",
}
VCOLOR = {
    "name": "VehicleColor",
    "slotType": "VehicleColor",
    "required": False,
    "promptEn": "What color is the vehicle?",
    "promptEs": "¿De qué color es el vehículo?",
}
VMAKE = {
    "name": "VehicleMake",
    "slotType": "FreeText",
    "required": False,
    "promptEn": "Do you know the make of the vehicle — Ford, Toyota, Honda?",
    "promptEs": "¿Sabe la marca del vehículo — Ford, Toyota, Honda?",
}
VMODEL = {
    "name": "VehicleModel",
    "slotType": "FreeText",
    "required": False,
    "promptEn": "Do you know the model?",
    "promptEs": "¿Sabe el modelo?",
}
VPLATE = {
    "name": "VehiclePlate",
    "slotType": "FreeText",
    "required": False,
    "promptEn": "Do you have a license plate number?",
    "promptEs": "¿Tiene el número de placa?",
}

LOCATION_INTENTS = {
    "NoiseComplaint",
    "SuspiciousPerson",
    "AbandonedVehicle",
    "VehicleBurglary",
    "TheftReport",
    "ParkingComplaint",
    "WelfareCheck",
    "AnimalComplaint",
    "TowComplaint",
    "VandalismDamage",
    "CodeEnforcementComplaint",
    "PublicWorksIssue",
    "TrafficAccidentReportOnly",
}
VEHICLE_INTENTS = {
    "AbandonedVehicle",
    "VehicleBurglary",
    "ParkingComplaint",
    "TowComplaint",
    "TrafficAccidentReportOnly",
}


def has_slot(slots: list[dict], name: str) -> bool:
    return any(s.get("name") == name for s in slots)


def insert_after(slots: list[dict], after_names: tuple[str, ...], new_slot: dict) -> None:
    if has_slot(slots, new_slot["name"]):
        return
    idx = 0
    for i, s in enumerate(slots):
        if s.get("name") in after_names:
            idx = i + 1
    slots.insert(idx, new_slot)


def main() -> None:
    spec = json.loads(SPEC.read_text(encoding="utf-8"))
    for intent in spec["intents"]:
        name = intent["name"]
        slots: list[dict] = intent.setdefault("slots", [])
        if name in LOCATION_INTENTS:
            insert_after(
                slots,
                (
                    "NoiseLocation",
                    "SuspiciousLocation",
                    "VehicleLocation",
                    "BurglaryVehicleLocation",
                    "TheftLocation",
                    "ParkingLocation",
                    "WelfareCheckAddress",
                    "AnimalLocation",
                    "TowLocation",
                    "VandalismLocation",
                    "CodeEnforcementAddress",
                    "PublicWorksLocation",
                    "AccidentLocation",
                ),
                APT,
            )
            insert_after(slots, ("AptBusiness",), CROSS)
        if name in VEHICLE_INTENTS:
            insert_after(
                slots,
                (
                    "VehicleDescription",
                    "BurglaryVehicleDescription",
                    "ParkingVehicleDescription",
                    "TowVehicleDescription",
                    "OtherVehicleDescription",
                    "CrossStreets",
                ),
                VCOLOR,
            )
            insert_after(slots, ("VehicleColor",), VMAKE)
            insert_after(slots, ("VehicleMake",), VMODEL)
            if name != "VehicleBurglary":
                insert_after(slots, ("VehicleModel",), VPLATE)
    SPEC.write_text(json.dumps(spec, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"updated {SPEC}")


if __name__ == "__main__":
    main()
