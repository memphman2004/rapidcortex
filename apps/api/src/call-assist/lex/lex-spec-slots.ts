/** Generated from infra/lex/bot-spec.json — do not edit by hand. Run scripts/generate-lex-bot-locales.py */

export type LexSpecSlot = {
  name: string;
  required: boolean;
  promptEn: string;
  promptEs: string;
};

export const LEX_SPEC_INTENT_ORDER = [
  "EmergencyEscalation",
  "RequestHuman",
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
  "OnlineReportEligibility",
  "RepeatCallCheck",
  "InformationRequest",
  "FallbackIntent"
] as const;

export const LEX_SPEC_SLOTS: Record<string, LexSpecSlot[]> = {
  "EmergencyEscalation": [],
  "RequestHuman": [],
  "NoiseComplaint": [
    {
      "name": "NoiseLocation",
      "required": true,
      "promptEn": "What's the address or location of the noise?",
      "promptEs": "¿Cuál es la dirección o el lugar donde está el ruido?"
    },
    {
      "name": "NoiseType",
      "required": true,
      "promptEn": "What kind of noise is it — music, people yelling, a party, something else?",
      "promptEs": "¿Qué tipo de ruido es — música, gritos, una fiesta, o algo más?"
    },
    {
      "name": "NoiseStillHappening",
      "required": true,
      "promptEn": "Is the noise still happening right now?",
      "promptEs": "¿El ruido todavía está ocurriendo ahora mismo?"
    },
    {
      "name": "CallbackNumber",
      "required": false,
      "promptEn": "And what's a good callback number in case we need to reach you?",
      "promptEs": "¿Y cuál es un número de teléfono para contactarle si es necesario?"
    }
  ],
  "SuspiciousPerson": [
    {
      "name": "SuspiciousLocation",
      "required": true,
      "promptEn": "Where is this person right now — what's the address or nearest intersection?",
      "promptEs": "¿Dónde está esta persona ahora — cuál es la dirección o la intersección más cercana?"
    },
    {
      "name": "PersonDescription",
      "required": true,
      "promptEn": "Can you describe the person? Things like what they're wearing, their approximate age, height, or anything that stands out.",
      "promptEs": "¿Puede describir a la persona? Por ejemplo, qué ropa lleva, su edad aproximada, estatura, o algo que llame la atención."
    },
    {
      "name": "PersonDirection",
      "required": true,
      "promptEn": "Do you know which direction they're heading, or are they still in the same spot?",
      "promptEs": "¿Sabe hacia dónde se dirigen, o siguen en el mismo lugar?"
    },
    {
      "name": "WeaponVisible",
      "required": true,
      "promptEn": "Have you seen any weapons — anything in their hands or visible on them?",
      "promptEs": "¿Ha visto algún arma — algo en sus manos o visible en ellos?"
    },
    {
      "name": "CallbackNumber",
      "required": true,
      "promptEn": "What's your callback number in case an officer needs to reach you?",
      "promptEs": "¿Cuál es su número de teléfono para que un oficial pueda contactarle?"
    },
    {
      "name": "CallerSafeLocation",
      "required": true,
      "promptEn": "Are you in a safe location right now?",
      "promptEs": "¿Está en un lugar seguro ahora mismo?"
    }
  ],
  "AbandonedVehicle": [
    {
      "name": "VehicleLocation",
      "required": true,
      "promptEn": "What's the address or nearest intersection where the vehicle is located?",
      "promptEs": "¿Cuál es la dirección o la intersección más cercana donde está el vehículo?"
    },
    {
      "name": "VehicleDescription",
      "required": true,
      "promptEn": "Can you describe the vehicle? Color, make or model if you know it, and any license plate?",
      "promptEs": "¿Puede describir el vehículo? Color, marca o modelo si lo sabe, y placa si es posible."
    },
    {
      "name": "HowLongAbandoned",
      "required": true,
      "promptEn": "About how long has the vehicle been there?",
      "promptEs": "¿Aproximadamente cuánto tiempo lleva el vehículo ahí?"
    },
    {
      "name": "AbandonedVehicleHazard",
      "required": true,
      "promptEn": "Is the vehicle blocking traffic, a driveway, or a fire hydrant?",
      "promptEs": "¿El vehículo está bloqueando el tráfico, una entrada, o un hidrante?"
    }
  ],
  "VehicleBurglary": [
    {
      "name": "BurglaryVehicleLocation",
      "required": true,
      "promptEn": "Where is your vehicle right now — what's the address?",
      "promptEs": "¿Dónde está su vehículo ahora — cuál es la dirección?"
    },
    {
      "name": "BurglaryVehicleDescription",
      "required": true,
      "promptEn": "What's the year, make, model, and color of your vehicle?",
      "promptEs": "¿Cuál es el año, marca, modelo y color de su vehículo?"
    },
    {
      "name": "BurglaryVehiclePlate",
      "required": true,
      "promptEn": "And the license plate number if you have it?",
      "promptEs": "¿Y el número de placa si lo tiene?"
    },
    {
      "name": "ItemsStolen",
      "required": true,
      "promptEn": "What was taken or what damage was done?",
      "promptEs": "¿Qué le robaron o qué daños hubo?"
    },
    {
      "name": "WhenOccurred",
      "required": true,
      "promptEn": "Do you know approximately when this happened?",
      "promptEs": "¿Sabe aproximadamente cuándo ocurrió esto?"
    },
    {
      "name": "SuspectSeen",
      "required": true,
      "promptEn": "Did you see anyone in or near your vehicle?",
      "promptEs": "¿Vio a alguien dentro o cerca de su vehículo?"
    },
    {
      "name": "CallbackNumber",
      "required": true,
      "promptEn": "What's the best number to reach you?",
      "promptEs": "¿Cuál es el mejor número para contactarle?"
    }
  ],
  "TheftReport": [
    {
      "name": "TheftLocation",
      "required": true,
      "promptEn": "Where did the theft occur?",
      "promptEs": "¿Dónde ocurrió el robo?"
    },
    {
      "name": "TheftItemDescription",
      "required": true,
      "promptEn": "What was taken? Can you describe the items and their approximate value?",
      "promptEs": "¿Qué le robaron? ¿Puede describir los artículos y su valor aproximado?"
    },
    {
      "name": "TheftWhenOccurred",
      "required": true,
      "promptEn": "When did this happen?",
      "promptEs": "¿Cuándo ocurrió?"
    },
    {
      "name": "TheftSuspectInfo",
      "required": false,
      "promptEn": "Do you have any description of the person who took it, or did you see how they left?",
      "promptEs": "¿Tiene alguna descripción de la persona que lo tomó, o vio cómo se fueron?"
    },
    {
      "name": "TheftCallbackNumber",
      "required": true,
      "promptEn": "What's the best number to reach you?",
      "promptEs": "¿Cuál es el mejor número para contactarle?"
    }
  ],
  "ParkingComplaint": [
    {
      "name": "ParkingLocation",
      "required": true,
      "promptEn": "What's the address where the vehicle is illegally parked?",
      "promptEs": "¿Cuál es la dirección donde el vehículo está estacionado ilegalmente?"
    },
    {
      "name": "ParkingVehicleDescription",
      "required": true,
      "promptEn": "Can you describe the vehicle — color, make, model, and license plate if you have it?",
      "promptEs": "¿Puede describir el vehículo — color, marca, modelo y placa si la tiene?"
    },
    {
      "name": "ParkingViolationType",
      "required": true,
      "promptEn": "What's the violation — blocking a driveway, fire hydrant, handicap spot, no parking zone, or something else?",
      "promptEs": "¿Cuál es la infracción — bloqueando una entrada, un hidrante, zona de discapacitados, zona de no estacionamiento, u otra?"
    }
  ],
  "WelfareCheck": [
    {
      "name": "WelfareCheckAddress",
      "required": true,
      "promptEn": "What's the address of the person you're concerned about?",
      "promptEs": "¿Cuál es la dirección de la persona por la que está preocupado?"
    },
    {
      "name": "WelfareCheckPersonName",
      "required": false,
      "promptEn": "What's the name of the person, if you know it?",
      "promptEs": "¿Cuál es el nombre de la persona, si lo sabe?"
    },
    {
      "name": "WelfareCheckRelationship",
      "required": true,
      "promptEn": "What's your relationship to this person — neighbor, family member, friend?",
      "promptEs": "¿Cuál es su relación con esta persona — vecino, familiar, amigo?"
    },
    {
      "name": "WelfareCheckLastContact",
      "required": true,
      "promptEn": "When did you last have contact with them?",
      "promptEs": "¿Cuándo fue la última vez que tuvo contacto con ellos?"
    },
    {
      "name": "WelfareCheckWhyConcerned",
      "required": true,
      "promptEn": "Can you tell me why you're concerned? Is there anything specific that made you call today?",
      "promptEs": "¿Puede decirme por qué está preocupado? ¿Hay algo específico que le hizo llamar hoy?"
    },
    {
      "name": "WelfareCheckCallerCallback",
      "required": true,
      "promptEn": "And what's the best number to reach you?",
      "promptEs": "¿Y cuál es el mejor número para contactarle?"
    }
  ],
  "AnimalComplaint": [
    {
      "name": "AnimalLocation",
      "required": true,
      "promptEn": "Where is the animal right now?",
      "promptEs": "¿Dónde está el animal ahora mismo?"
    },
    {
      "name": "AnimalType",
      "required": true,
      "promptEn": "What kind of animal is it — a dog, cat, or something else?",
      "promptEs": "¿Qué tipo de animal es — un perro, gato, u otro?"
    },
    {
      "name": "AnimalThreatLevel",
      "required": true,
      "promptEn": "Is the animal injured, aggressive, or acting threatening? Or is it more of a stray or nuisance situation?",
      "promptEs": "¿El animal está herido, es agresivo, o amenazante? ¿O es más un animal callejero o una molestia?"
    }
  ],
  "TowComplaint": [
    {
      "name": "TowLocation",
      "required": true,
      "promptEn": "Where was your vehicle when it was towed from?",
      "promptEs": "¿De dónde se llevaron su vehículo?"
    },
    {
      "name": "TowVehicleDescription",
      "required": true,
      "promptEn": "What's the year, make, model, color, and license plate of your vehicle?",
      "promptEs": "¿Cuál es el año, marca, modelo, color y placa de su vehículo?"
    },
    {
      "name": "TowCompanyInfo",
      "required": false,
      "promptEn": "Do you know the name of the tow company, or did you see the truck?",
      "promptEs": "¿Sabe el nombre de la empresa de grúa, o vio el camión?"
    },
    {
      "name": "TowCallbackNumber",
      "required": true,
      "promptEn": "What's the best number to reach you?",
      "promptEs": "¿Cuál es el mejor número para contactarle?"
    }
  ],
  "VandalismDamage": [
    {
      "name": "VandalismLocation",
      "required": true,
      "promptEn": "What's the address of the property that was damaged?",
      "promptEs": "¿Cuál es la dirección de la propiedad que fue dañada?"
    },
    {
      "name": "VandalismDescription",
      "required": true,
      "promptEn": "What was damaged and how?",
      "promptEs": "¿Qué fue dañado y cómo?"
    },
    {
      "name": "VandalismWhenOccurred",
      "required": true,
      "promptEn": "When did you discover the damage?",
      "promptEs": "¿Cuándo descubrió el daño?"
    },
    {
      "name": "VandalismSuspectInfo",
      "required": false,
      "promptEn": "Did you see anyone do this or do you have any idea who's responsible?",
      "promptEs": "¿Vio a alguien hacerlo o sabe quién pudo ser responsable?"
    }
  ],
  "CodeEnforcementComplaint": [
    {
      "name": "CodeEnforcementAddress",
      "required": true,
      "promptEn": "What's the address of the property?",
      "promptEs": "¿Cuál es la dirección de la propiedad?"
    },
    {
      "name": "CodeViolationDescription",
      "required": true,
      "promptEn": "What's the violation? For example, high grass, trash, junk cars, or something else?",
      "promptEs": "¿Cuál es la infracción? Por ejemplo, pasto alto, basura, carros en desuso, u otra cosa?"
    }
  ],
  "PublicWorksIssue": [
    {
      "name": "PublicWorksLocation",
      "required": true,
      "promptEn": "What's the location — address or nearest intersection?",
      "promptEs": "¿Cuál es la ubicación — dirección o intersección más cercana?"
    },
    {
      "name": "PublicWorksIssueType",
      "required": true,
      "promptEn": "What's the issue — a water main, pothole, traffic light, streetlight, or something else?",
      "promptEs": "¿Cuál es el problema — tubería, bache, semáforo, luz de calle, u otra cosa?"
    }
  ],
  "TrafficAccidentReportOnly": [
    {
      "name": "AccidentLocation",
      "required": true,
      "promptEn": "Where did the accident happen?",
      "promptEs": "¿Dónde ocurrió el accidente?"
    },
    {
      "name": "AccidentWhen",
      "required": true,
      "promptEn": "When did it happen?",
      "promptEs": "¿Cuándo ocurrió?"
    },
    {
      "name": "AccidentInjuries",
      "required": true,
      "promptEn": "Were there any injuries?",
      "promptEs": "¿Hubo heridos?"
    },
    {
      "name": "OtherVehicleDescription",
      "required": false,
      "promptEn": "Can you describe the other vehicle involved, if there was one?",
      "promptEs": "¿Puede describir el otro vehículo involucrado, si hubo alguno?"
    },
    {
      "name": "AccidentCallbackNumber",
      "required": true,
      "promptEn": "What's the best number to reach you?",
      "promptEs": "¿Cuál es el mejor número para contactarle?"
    }
  ],
  "OnlineReportEligibility": [],
  "RepeatCallCheck": [
    {
      "name": "PriorReferenceNumber",
      "required": false,
      "promptEn": "Do you have a reference number from your earlier call?",
      "promptEs": "¿Tiene un número de referencia de su llamada anterior?"
    },
    {
      "name": "PriorCallbackNumber",
      "required": false,
      "promptEn": "What phone number did you call from before, so we can look up your report?",
      "promptEs": "¿Desde qué número llamó antes para que podamos buscar su reporte?"
    }
  ],
  "InformationRequest": [
    {
      "name": "InformationTopic",
      "required": true,
      "promptEn": "Sure — what do you need information about?",
      "promptEs": "Claro — ¿sobre qué necesita información?"
    }
  ],
  "FallbackIntent": []
};

export const LEX_SPEC_LOCATION_SLOT_NAMES = ["location", "building", "section", "NoiseLocation", "SuspiciousLocation", "CallerSafeLocation", "VehicleLocation", "BurglaryVehicleLocation", "TheftLocation", "ParkingLocation", "WelfareCheckAddress", "AnimalLocation", "TowLocation", "VandalismLocation", "CodeEnforcementAddress", "PublicWorksLocation", "AccidentLocation"] as const;

export const LEX_SPEC_CALLBACK_SLOT_NAMES = ["callbackNumber", "CallbackNumber", "TheftCallbackNumber", "WelfareCheckCallerCallback", "TowCallbackNumber", "AccidentCallbackNumber", "PriorCallbackNumber"] as const;

export const LEX_SPEC_CONFIRMATION_INTENTS = new Set<string>(
  ["NoiseComplaint", "SuspiciousPerson", "AbandonedVehicle", "VehicleBurglary", "TheftReport", "ParkingComplaint", "WelfareCheck", "AnimalComplaint", "TowComplaint", "VandalismDamage", "CodeEnforcementComplaint", "TrafficAccidentReportOnly"],
);
