/**
 * 311 category disambiguation — infers SubIssue slots from the caller transcript.
 * Used by the existing dialog hook; does not replace the 911 safety gate.
 */

export type DisambiguationResult = {
  inferredSubIssue?: string;
  inferredIsOngoing?: string;
  clarificationQuestion?: string;
  elevated?: boolean;
};

export type DisambiguationRule = {
  intentName: string;
  subIssueSlotName: string;
  check: (transcript: string) => DisambiguationResult | null;
};

export const DISAMBIGUATION_RULES: DisambiguationRule[] = [
  {
    intentName: "ReportWaterSewerDrainage",
    subIssueSlotName: "WaterSubIssue",
    check: (transcript) => {
      if (/water.*(gushing|shooting|geyser|erupting)/i.test(transcript)) {
        return { inferredSubIssue: "WATER_MAIN_BREAK", elevated: true };
      }
      if (/water.*(coming from|bubbling from|coming up from) the ground/i.test(transcript)) {
        return { inferredSubIssue: "WATER_MAIN_LEAK" };
      }
      if (/no water|water (is|turned) off|lost water service/i.test(transcript)) {
        return { inferredSubIssue: "NO_WATER_SERVICE" };
      }
      if (/water (is |looks )?(brown|discolored|rusty|cloudy|dirty)/i.test(transcript)) {
        return { inferredSubIssue: "WATER_QUALITY_COLOR" };
      }
      if (/water (smells|stinks|odor)/i.test(transcript)) {
        return { inferredSubIssue: "WATER_QUALITY_ODOR" };
      }
      if (/sewer.*back(ing)? up|sewage.*street|manhole.*overflow/i.test(transcript)) {
        return { inferredSubIssue: "SEWER_BACKUP_PUBLIC", elevated: true };
      }
      if (/sewer smell|smells like sewer/i.test(transcript)) {
        return { inferredSubIssue: "SEWER_ODOR_COMPLAINT" };
      }
      if (/drain (is |is being )?blocked|catch basin|clogged drain/i.test(transcript)) {
        return { inferredSubIssue: "STORM_DRAIN_BLOCKED" };
      }
      if (/water (on|in) (the |my |our )?(street|road)|water pooling|standing water (on|after)/i.test(transcript)) {
        return {
          clarificationQuestion:
            "Is water bubbling up from the ground, pooling on the surface after rain, or coming from a broken pipe or fire hydrant?",
        };
      }
      if (/water bill|billing dispute|bill is wrong|dispute.*water/i.test(transcript)) {
        return { inferredSubIssue: "WATER_BILL_DISPUTE" };
      }
      return null;
    },
  },
  {
    intentName: "ReportNoiseComplaint",
    subIssueSlotName: "NoiseSubIssue",
    check: (transcript) => {
      if (/dog.*(barking|bark|won't stop)/i.test(transcript)) return { inferredSubIssue: "DOG_BARKING" };
      if (/car alarm|vehicle alarm/i.test(transcript)) return { inferredSubIssue: "CAR_ALARM" };
      if (/fireworks/i.test(transcript)) return { inferredSubIssue: "ILLEGAL_FIREWORKS" };
      if (/construction.*(early|loud|before)/i.test(transcript)) return { inferredSubIssue: "CONSTRUCTION_NOISE" };
      if (/(loud )?(music|bass|stereo).*(apartment|house|next door|neighbor)/i.test(transcript)) {
        return { inferredSubIssue: "LOUD_MUSIC_RESIDENTIAL" };
      }
      if (/(loud )?(music|bass|stereo).*(bar|restaurant|club|business)/i.test(transcript)) {
        return { inferredSubIssue: "LOUD_MUSIC_COMMERCIAL" };
      }
      if (/party.*(loud|noise|late|night|2 am|3 am)/i.test(transcript)) {
        return { inferredSubIssue: "LOUD_PARTY_NIGHTTIME" };
      }
      if (/leaf blower|lawn mower|landscaping.*(early|before|hours)/i.test(transcript)) {
        return { inferredSubIssue: "LANDSCAPING_NOISE" };
      }
      if (/loud.*(exhaust|motorcycle|car|muffler)/i.test(transcript)) {
        return { inferredSubIssue: "VEHICLE_NOISE_EXHAUST" };
      }
      return null;
    },
  },
  {
    intentName: "ReportAnimalsPests",
    subIssueSlotName: "AnimalSubIssue",
    check: (transcript) => {
      if (/dog.*(bite|bit|attacked|attack)/i.test(transcript)) {
        if (/biting right now|attacking right now|attack in progress/i.test(transcript)) {
          return { inferredSubIssue: "STRAY_DOG_AT_LARGE", elevated: true };
        }
        return { inferredSubIssue: "DOG_BITE_FOLLOWUP" };
      }
      if (/stray dog|loose dog|dog running loose|dog with no owner/i.test(transcript)) {
        return { inferredSubIssue: "STRAY_DOG_AT_LARGE" };
      }
      if (/aggressive dog|vicious dog|dog keeps charging|dangerous dog/i.test(transcript)) {
        return { inferredSubIssue: "VICIOUS_DOG_COMPLAINT" };
      }
      if (/barking dog|dog won't stop barking|neighbor.*dog.*barking/i.test(transcript)) {
        return { inferredSubIssue: "DOG_BARKING" };
      }
      if (/animal neglect|animal abuse|animal cruelty/i.test(transcript)) {
        return { inferredSubIssue: "ANIMAL_NEGLECT" };
      }
      if (/raccoon/i.test(transcript)) return { inferredSubIssue: "WILDLIFE_RACCOON" };
      if (/coyote/i.test(transcript)) return { inferredSubIssue: "WILDLIFE_COYOTE" };
      if (/rat|mouse|mice|rodent/i.test(transcript)) return { inferredSubIssue: "RODENT_INFESTATION" };
      if (/bee swarm|swarm of bees/i.test(transcript)) return { inferredSubIssue: "BEE_SWARM_PUBLIC" };
      if (/wasp|hornet|yellow jacket/i.test(transcript)) return { inferredSubIssue: "WASP_HORNET_NEST" };
      if (/dead animal/i.test(transcript)) return { inferredSubIssue: "DEAD_ANIMAL_PICKUP" };
      if (/pigeon|bird.*nuisance|nuisance.*bird/i.test(transcript)) return { inferredSubIssue: "PIGEON_NUISANCE" };
      return null;
    },
  },
  {
    intentName: "ReportBuildingsHousing",
    subIssueSlotName: "BuildingSubIssue",
    check: (transcript) => {
      if (/(no heat|heat (is |'s )?(out|off|broken)|heat not working).*(apartment|my unit|renter|tenant|landlord)/i.test(transcript)) {
        return { inferredSubIssue: "NO_HEAT_TENANT" };
      }
      if (/no hot water.*(apartment|unit|renter|tenant|landlord)/i.test(transcript)) {
        return { inferredSubIssue: "NO_HOT_WATER_TENANT" };
      }
      if (/mold.*(apartment|unit|landlord|won't fix)/i.test(transcript)) return { inferredSubIssue: "MOLD_COMPLAINT" };
      if (/lead paint/i.test(transcript)) return { inferredSubIssue: "LEAD_PAINT_CONCERN" };
      if (/roach|cockroach|rat.*(unit|apartment|building)/i.test(transcript)) {
        return { inferredSubIssue: "PEST_INFESTATION_TENANT" };
      }
      if (/building without (a )?permit|construction without (a )?permit|unpermitted/i.test(transcript)) {
        return { inferredSubIssue: "UNPERMITTED_CONSTRUCTION" };
      }
      if (/abandoned (building|property|house)|vacant building/i.test(transcript)) {
        return { inferredSubIssue: "ABANDONED_BUILDING" };
      }
      if (/illegal (apartment|unit|conversion)|basement (apartment|unit) without/i.test(transcript)) {
        return { inferredSubIssue: "ILLEGAL_CONVERSION" };
      }
      if (/fire escape.*(blocked|can't access)|blocked egress/i.test(transcript)) {
        return { inferredSubIssue: "BLOCKED_FIRE_ESCAPE", elevated: true };
      }
      return null;
    },
  },
  {
    intentName: "ReportRoadsInfrastructure",
    subIssueSlotName: "RoadsSubIssue",
    check: (transcript) => {
      if (/potholes?|hole in the (road|street)/i.test(transcript)) return { inferredSubIssue: "POTHOLE" };
      if (/sinkhole|road is sinking|collapsing/i.test(transcript)) return { inferredSubIssue: "SINKHOLE", elevated: true };
      if (/(sidewalk|curb).*(broken|cracked|damaged|uneven)/i.test(transcript)) {
        return { inferredSubIssue: "DAMAGED_SIDEWALK" };
      }
      if (/manhole (cover )?(missing|gone|open)/i.test(transcript)) {
        return { inferredSubIssue: "MISSING_MANHOLE_COVER", elevated: true };
      }
      if (/(street|road).*(flooded|flooding|under water)/i.test(transcript)) return { inferredSubIssue: "STREET_FLOODING" };
      if (/not (salted|plowed|sanded)|snow not (plowed|removed)/i.test(transcript)) {
        return { inferredSubIssue: "SNOW_ICE_REMOVAL" };
      }
      if (/dead animal (in|on) (the )?(road|street)/i.test(transcript)) return { inferredSubIssue: "DEAD_ANIMAL_IN_ROAD" };
      if (/debris (in|on|blocking) (the )?(road|street)/i.test(transcript)) return { inferredSubIssue: "DEBRIS_IN_ROADWAY" };
      return null;
    },
  },
  {
    intentName: "ReportTreesVegetation",
    subIssueSlotName: "TreeSubIssue",
    check: (transcript) => {
      if (/downed tree|fallen tree|tree (is |was )?down|tree fell|tree across|tree blocking/i.test(transcript)) {
        if (/sidewalk|walkway|path|footpath/i.test(transcript)) {
          return {
            inferredSubIssue: "FALLEN_TREE_SIDEWALK",
            inferredIsOngoing: "HAPPENING_NOW",
            elevated: true,
          };
        }
        return {
          inferredSubIssue: "FALLEN_TREE_ROAD",
          inferredIsOngoing: "HAPPENING_NOW",
          elevated: true,
        };
      }
      if (/dead tree|dying (street )?tree|tree (is )?dead/i.test(transcript)) {
        return { inferredSubIssue: "DEAD_STREET_TREE" };
      }
      if (/(branch|limb).*(down|fell|fallen)|downed (branch|limb)/i.test(transcript)) {
        return { inferredSubIssue: "DOWNED_BRANCH", inferredIsOngoing: "HAPPENING_NOW" };
      }
      if (/(roots?).*(sidewalk|pavement|curb)|sidewalk.*(roots?)/i.test(transcript)) {
        return { inferredSubIssue: "ROOTS_DAMAGING_SIDEWALK" };
      }
      if (/(trim|trimming|overgrown).*(tree|branch)/i.test(transcript)) {
        return { inferredSubIssue: "TREE_TRIMMING_REQUEST" };
      }
      if (/(bush|bushes|vegetation|shrubs?).*(block|cover).*(sign|stop)/i.test(transcript)) {
        return { inferredSubIssue: "OVERGROWN_SIGN_COVERAGE" };
      }
      if (/(bush|bushes|vegetation|shrubs?).*(block).*(sidewalk|walk)/i.test(transcript)) {
        return { inferredSubIssue: "OVERGROWN_SIDEWALK_BLOCK" };
      }
      return null;
    },
  },
  {
    intentName: "ReportLawEnforcementNonEmergency",
    subIssueSlotName: "LawEnforcementSubIssue",
    check: (transcript) => {
      if (/happening right now|right now|in progress|currently happening/i.test(transcript)) return null;
      if (/speed(ing)? (on|down) (my |the )?street|cars going too fast/i.test(transcript)) {
        return { inferredSubIssue: "CHRONIC_SPEEDING" };
      }
      if (/drug (deal|activity|selling) (on|at|near)/i.test(transcript)) {
        return { inferredSubIssue: "CHRONIC_DRUG_ACTIVITY" };
      }
      if (/(package|mail|porch pirate)/i.test(transcript)) return { inferredSubIssue: "PACKAGE_MAIL_THEFT_PAST" };
      if (/catalytic converter|copper (theft|wire)|metal theft/i.test(transcript)) {
        return { inferredSubIssue: "COPPER_CATALYTIC_THEFT" };
      }
      if (/ATV|dirt bike|four wheeler|off.road vehicle/i.test(transcript)) {
        return { inferredSubIssue: "ILLEGAL_ATV_DIRTBIKE" };
      }
      if (/more patrol|extra patrol|need police (in|at|on)/i.test(transcript)) {
        return { inferredSubIssue: "EXTRA_PATROL_REQUEST" };
      }
      if (/status (of |on )?(my )?(case|report|investigation)/i.test(transcript)) {
        return { inferredSubIssue: "POLICE_REPORT_STATUS" };
      }
      return null;
    },
  },
  {
    intentName: "ReportHomelessSocialServices",
    subIssueSlotName: "HomelessSubIssue",
    check: (transcript) => {
      if (/welfare check|check on (a |the )?person|person (looks|appears|seems) (sick|unwell|ill)/i.test(transcript)) {
        return { inferredSubIssue: "WELFARE_CHECK_REQUEST" };
      }
      if (/needle|syringe|sharp|sharps/i.test(transcript)) return { inferredSubIssue: "SHARPS_DEBRIS" };
      if (/encampment|tent|tents|camp/i.test(transcript)) {
        if (/school/i.test(transcript)) return { inferredSubIssue: "ENCAMPMENT_NEAR_SCHOOL" };
        if (/park/i.test(transcript)) return { inferredSubIssue: "ENCAMPMENT_PARK" };
        if (/(under|beneath) (the )?(bridge|freeway|overpass)/i.test(transcript)) {
          return { inferredSubIssue: "ENCAMPMENT_BRIDGE" };
        }
        return { inferredSubIssue: "ENCAMPMENT_SIDEWALK" };
      }
      if (/person (sleeping|in) (a )?doorway|blocking (the )?entrance/i.test(transcript)) {
        return { inferredSubIssue: "INDIVIDUAL_IN_DOORWAY" };
      }
      if (/(services|shelter|housing|assistance|help)/i.test(transcript)) {
        return { inferredSubIssue: "SOCIAL_SERVICE_REFERRAL" };
      }
      return null;
    },
  },
  {
    intentName: "ReportStreetLighting",
    subIssueSlotName: "LightingSubIssue",
    check: (transcript) => {
      if (/whole block|several (street ?)?lights? out|multiple lights out/i.test(transcript)) {
        return { inferredSubIssue: "STREETLIGHT_OUT_MULTIPLE" };
      }
      if (/wires? hanging|exposed wir|sparking|live wire/i.test(transcript)) {
        return { inferredSubIssue: "EXPOSED_WIRING_ON_POLE", elevated: true };
      }
      if (/traffic (light|signal).*(dark|out|not working|dead)|intersection.*(dark|no lights)/i.test(transcript)) {
        if (/completely|all (dark|out)|none of the lights/i.test(transcript)) {
          return { inferredSubIssue: "TRAFFIC_SIGNAL_ALL_DARK", elevated: true };
        }
        return { inferredSubIssue: "TRAFFIC_SIGNAL_LIGHT_OUT" };
      }
      if (/stuck on (red|green)|not changing|timing/i.test(transcript)) {
        return { inferredSubIssue: "SIGNAL_WRONG_SEQUENCE" };
      }
      if (/walk signal|pedestrian (signal|light)|crosswalk (button|signal)/i.test(transcript)) {
        if (/button/i.test(transcript)) return { inferredSubIssue: "CROSSWALK_BUTTON_BROKEN" };
        return { inferredSubIssue: "PEDESTRIAN_SIGNAL_ISSUE" };
      }
      if (/(pole).*(lean|tilt|hit|bent|down)|leaning pole/i.test(transcript)) {
        return { inferredSubIssue: "LEANING_POLE", elevated: true };
      }
      if (/(pole).*(damaged|broken|hit by)/i.test(transcript)) {
        return { inferredSubIssue: "DAMAGED_LIGHT_POLE" };
      }
      if (/flicker|flashing streetlight|keeps going on and off/i.test(transcript)) {
        return { inferredSubIssue: "STREETLIGHT_FLICKERING" };
      }
      if (/(on during the day|stays on|never turns off)/i.test(transcript)) {
        return { inferredSubIssue: "STREETLIGHT_ON_DAYTIME" };
      }
      if (/street ?light|street ?lamp|light (is |not )?out|dark street/i.test(transcript)) {
        return { inferredSubIssue: "STREETLIGHT_OUT_SINGLE" };
      }
      if (/\blight\b|\bsignal\b/i.test(transcript)) {
        return {
          clarificationQuestion:
            "Is this a streetlight that's out, a traffic signal problem, a damaged pole, or something else?",
        };
      }
      return null;
    },
  },
  {
    intentName: "ReportTrafficSignsMarkings",
    subIssueSlotName: "SignsSubIssue",
    check: (transcript) => {
      if (/stop sign.*(gone|missing|down)|no stop sign/i.test(transcript)) {
        return { inferredSubIssue: "MISSING_STOP_SIGN", elevated: true };
      }
      if (/yield sign.*(gone|missing)/i.test(transcript)) return { inferredSubIssue: "MISSING_YIELD_SIGN" };
      if (/street (name )?sign.*(gone|missing)/i.test(transcript)) return { inferredSubIssue: "MISSING_STREET_SIGN" };
      if (/speed limit sign.*(gone|missing)/i.test(transcript)) {
        return { inferredSubIssue: "MISSING_SPEED_LIMIT_SIGN" };
      }
      if (/tree.*(cover|block).*sign|vegetation.*(cover|block).*sign/i.test(transcript)) {
        return { inferredSubIssue: "SIGN_OBSTRUCTED_BY_TREE" };
      }
      if (/faded crosswalk|can't see (the )?crosswalk/i.test(transcript)) {
        return { inferredSubIssue: "FADED_CROSSWALK" };
      }
      if (/faded (lane|lines|markings)|can't see the lanes/i.test(transcript)) {
        return { inferredSubIssue: "FADED_LANE_MARKINGS" };
      }
      if (/(sign).*(bent|broken|hit|damaged)/i.test(transcript)) return { inferredSubIssue: "DAMAGED_SIGN" };
      if (/(sign).*(faded|can't read)/i.test(transcript)) return { inferredSubIssue: "FADED_SIGN" };
      if (/\bsign\b|\bmarking/i.test(transcript)) {
        return {
          clarificationQuestion:
            "What's wrong with the sign or markings — missing, damaged, faded, or blocked?",
        };
      }
      return null;
    },
  },
  {
    intentName: "ReportSanitationWaste",
    subIssueSlotName: "SanitationSubIssue",
    check: (transcript) => {
      if (/missed (my )?(trash|garbage)|garbage not picked|skipped my trash/i.test(transcript)) {
        return { inferredSubIssue: "MISSED_GARBAGE_PICKUP" };
      }
      if (/missed recycl|recycling not picked|blue bin/i.test(transcript)) {
        return { inferredSubIssue: "MISSED_RECYCLING_PICKUP" };
      }
      if (/missed bulk|couch not picked|furniture still/i.test(transcript)) {
        return { inferredSubIssue: "MISSED_BULK_PICKUP" };
      }
      if (/yard waste|green bin missed|leaves not picked/i.test(transcript)) {
        return { inferredSubIssue: "MISSED_YARD_WASTE_PICKUP" };
      }
      if (/illegal dump|dumped trash|junk was dumped/i.test(transcript)) {
        return { inferredSubIssue: "ILLEGAL_DUMPING" };
      }
      if (/overflowing.*(trash|can|bin)|trash can is full/i.test(transcript)) {
        return { inferredSubIssue: "OVERFLOWING_PUBLIC_TRASH" };
      }
      if (/dead animal/i.test(transcript)) return { inferredSubIssue: "DEAD_ANIMAL_PICKUP" };
      if (/stolen.*(bin|can)|bin is missing/i.test(transcript)) return { inferredSubIssue: "STOLEN_CITY_BIN" };
      if (/broken.*(bin|can)|lid is broken/i.test(transcript)) return { inferredSubIssue: "DAMAGED_CITY_BIN" };
      if (/paint disposal|hazardous waste|chemical disposal/i.test(transcript)) {
        return { inferredSubIssue: "HAZARDOUS_WASTE_DISPOSAL" };
      }
      if (/^(trash|garbage|sanitation)$/i.test(transcript.trim())) {
        return {
          clarificationQuestion:
            "Is this a missed pickup, illegal dumping, an overflowing can, or something else?",
        };
      }
      return null;
    },
  },
  {
    intentName: "ReportVehicleIssue",
    subIssueSlotName: "VehicleSubIssue",
    check: (transcript) => {
      if (/block(ing)? (my )?driveway/i.test(transcript)) {
        return { inferredSubIssue: "VEHICLE_BLOCKING_DRIVEWAY", inferredIsOngoing: "HAPPENING_NOW" };
      }
      if (/block(ing)? (a |the )?hydrant/i.test(transcript)) {
        return { inferredSubIssue: "VEHICLE_BLOCKING_HYDRANT", inferredIsOngoing: "HAPPENING_NOW", elevated: true };
      }
      if (/on (the )?sidewalk|blocking (the )?walkway/i.test(transcript)) {
        return { inferredSubIssue: "VEHICLE_BLOCKING_SIDEWALK" };
      }
      if (/abandoned|been there for days|junked car|nobody moves/i.test(transcript)) {
        return { inferredSubIssue: "ABANDONED_VEHICLE_STREET" };
      }
      if (/no (license )?plates?|missing plate/i.test(transcript)) {
        return { inferredSubIssue: "MISSING_LICENSE_PLATE" };
      }
      if (/handicap|accessible (space|parking)|disabled space/i.test(transcript)) {
        return { inferredSubIssue: "ILLEGAL_ACCESSIBLE_SPACE" };
      }
      if (/double parked/i.test(transcript)) return { inferredSubIssue: "DOUBLE_PARKED" };
      if (/\b(car|truck|van|vehicle)\b/i.test(transcript)) {
        return {
          clarificationQuestion:
            "Is the vehicle abandoned, blocking a driveway or hydrant, parked illegally, or something else?",
        };
      }
      return null;
    },
  },
  {
    intentName: "ReportGraffitiVandalism",
    subIssueSlotName: "GraffitiSubIssue",
    check: (transcript) => {
      if (/bus (stop|shelter)|transit|subway/i.test(transcript)) return { inferredSubIssue: "GRAFFITI_TRANSIT" };
      if (/bridge|overpass|underpass/i.test(transcript)) return { inferredSubIssue: "GRAFFITI_BRIDGE" };
      if (/my (house|building|fence|property)|private/i.test(transcript)) {
        return { inferredSubIssue: "GRAFFITI_PRIVATE_PROPERTY" };
      }
      if (/park|playground|bench/i.test(transcript)) return { inferredSubIssue: "GRAFFITI_PARK_EQUIPMENT" };
      if (/utility box|electrical box|green box/i.test(transcript)) {
        return { inferredSubIssue: "GRAFFITI_UTILITY_BOX" };
      }
      if (/city (building|hall)|public (building|wall)/i.test(transcript)) {
        return { inferredSubIssue: "GRAFFITI_PUBLIC_BUILDING" };
      }
      if (/graffiti|tagged|spray paint|vandal/i.test(transcript)) {
        return {
          clarificationQuestion:
            "What was tagged — a city building, bus stop, bridge, park equipment, or private property?",
        };
      }
      return null;
    },
  },
  {
    intentName: "ReportParksPublicSpaces",
    subIssueSlotName: "ParkSubIssue",
    check: (transcript) => {
      if (/playground|swing|slide/i.test(transcript)) return { inferredSubIssue: "BROKEN_PLAYGROUND_EQUIP" };
      if (/restroom|bathroom|toilet/i.test(transcript)) {
        if (/lock/i.test(transcript)) return { inferredSubIssue: "PARK_RESTROOM_LOCKED" };
        if (/vandal/i.test(transcript)) return { inferredSubIssue: "PARK_RESTROOM_VANDALIZED" };
        return { inferredSubIssue: "PARK_RESTROOM_UNSANITARY" };
      }
      if (/park light|park is dark|path light/i.test(transcript)) return { inferredSubIssue: "PARK_LIGHT_OUT" };
      if (/splash pad|spray park/i.test(transcript)) return { inferredSubIssue: "SPLASH_PAD_NOT_WORKING" };
      if (/skate (park|ramp)/i.test(transcript)) return { inferredSubIssue: "SKATE_PARK_DAMAGE" };
      if (/needs mowing|grass too high|overgrown park/i.test(transcript)) {
        return { inferredSubIssue: "PARK_OVERGROWN" };
      }
      if (/camping|tent in (the )?park/i.test(transcript)) {
        return { inferredSubIssue: "UNAUTHORIZED_PARK_CAMPING" };
      }
      if (/\bpark\b/i.test(transcript)) {
        return {
          clarificationQuestion:
            "What's the park issue — broken equipment, lighting, restroom, or something else?",
        };
      }
      return null;
    },
  },
  {
    intentName: "ReportEnvironmentalHealth",
    subIssueSlotName: "EnvironmentalSubIssue",
    check: (transcript) => {
      if (/illegal burn|someone burning|burning trash/i.test(transcript)) {
        return { inferredSubIssue: "ILLEGAL_OPEN_BURNING" };
      }
      if (/spill|chemical leak/i.test(transcript)) {
        return { inferredSubIssue: "HAZARDOUS_SPILL_SMALL", elevated: true };
      }
      if (/restaurant|food (poison|safety)|dirty kitchen/i.test(transcript)) {
        return { inferredSubIssue: "RESTAURANT_SANITATION" };
      }
      if (/smoke/i.test(transcript)) return { inferredSubIssue: "AIR_QUALITY_SMOKE" };
      if (/odor|smell|air quality|stinks/i.test(transcript)) return { inferredSubIssue: "AIR_QUALITY_ODOR" };
      return null;
    },
  },
  {
    intentName: "ReportFireEMSNonEmergency",
    subIssueSlotName: "FireEMSSubIssue",
    check: (transcript) => {
      if (/fire lane/i.test(transcript)) {
        return { inferredSubIssue: "BLOCKED_FIRE_LANE", elevated: true };
      }
      if (/hydrant/i.test(transcript)) {
        return { inferredSubIssue: "BLOCKED_FIRE_HYDRANT_VEG", elevated: true };
      }
      if (/illegal burn|burning outside|burn pile/i.test(transcript)) {
        return { inferredSubIssue: "OUTDOOR_BURN_NO_PERMIT" };
      }
      if (/carbon monoxide|CO detector/i.test(transcript)) return { inferredSubIssue: "CO_DETECTOR_INQUIRY" };
      if (/smoke detector|smoke alarm/i.test(transcript)) return { inferredSubIssue: "SMOKE_DETECTOR_REQUEST" };
      if (/fire hazard/i.test(transcript)) return { inferredSubIssue: "FIRE_HAZARD_COMPLAINT" };
      return null;
    },
  },
  {
    intentName: "ReportTransitIssue",
    subIssueSlotName: "TransitSubIssue",
    check: (transcript) => {
      if (/bus shelter.*(glass|shatter)/i.test(transcript)) {
        return { inferredSubIssue: "BUS_SHELTER_GLASS_BROKEN" };
      }
      if (/bus shelter/i.test(transcript)) return { inferredSubIssue: "BUS_SHELTER_DAMAGED" };
      if (/bus stop (bench|sign)|bench at (the )?bus/i.test(transcript)) {
        return { inferredSubIssue: "BUS_STOP_BENCH_DAMAGED" };
      }
      if (/bike lane/i.test(transcript)) return { inferredSubIssue: "BIKE_LANE_BLOCKED" };
      if (/scooter|e-?bike on (the )?sidewalk/i.test(transcript)) {
        return { inferredSubIssue: "SCOOTER_SIDEWALK_BLOCKING" };
      }
      if (/parking meter|broken meter/i.test(transcript)) return { inferredSubIssue: "PARKING_METER_BROKEN" };
      if (/tow|impound/i.test(transcript)) return { inferredSubIssue: "TOW_INQUIRY" };
      return null;
    },
  },
  {
    intentName: "RequestGovernmentInformation",
    subIssueSlotName: "GovInfoSubIssue",
    check: (transcript) => {
      if (/hours|when (is|are) .*open|city hall/i.test(transcript)) {
        return { inferredSubIssue: "CITY_OFFICE_HOURS_LOCATION" };
      }
      if (/renew.*license/i.test(transcript)) return { inferredSubIssue: "BUSINESS_LICENSE_RENEW" };
      if (/business license/i.test(transcript)) return { inferredSubIssue: "BUSINESS_LICENSE_APPLY" };
      if (/birth certificate|vital record/i.test(transcript)) return { inferredSubIssue: "VITAL_RECORDS_REQUEST" };
      if (/where.*(vote|poll)|polling/i.test(transcript)) return { inferredSubIssue: "POLLING_LOCATION" };
      if (/register to vote/i.test(transcript)) return { inferredSubIssue: "VOTER_REGISTRATION" };
      if (/permit status/i.test(transcript)) return { inferredSubIssue: "BUILDING_PERMIT_STATUS" };
      if (/permit/i.test(transcript)) return { inferredSubIssue: "PERMIT_PROCESS_INFO" };
      if (/senior/i.test(transcript)) return { inferredSubIssue: "SENIOR_SERVICES" };
      if (/food assistance|snap|food bank/i.test(transcript)) return { inferredSubIssue: "FOOD_ASSISTANCE" };
      if (/rent|utility bill/i.test(transcript)) return { inferredSubIssue: "RENT_UTILITY_ASSISTANCE" };
      return null;
    },
  },
  {
    intentName: "ReportSpecialEventIssue",
    subIssueSlotName: "SpecialEventSubIssue",
    check: (transcript) => {
      if (/street closed|road closed|why is .*closed/i.test(transcript)) {
        return { inferredSubIssue: "STREET_CLOSURE_INQUIRY" };
      }
      if (/too loud|event noise|concert/i.test(transcript)) {
        return { inferredSubIssue: "EVENT_NOISE_COMPLAINT" };
      }
      if (/block party/i.test(transcript)) return { inferredSubIssue: "BLOCK_PARTY_PERMIT" };
      if (/event permit|special event permit/i.test(transcript)) {
        return { inferredSubIssue: "SPECIAL_EVENT_PERMIT_APP" };
      }
      if (/parade/i.test(transcript)) return { inferredSubIssue: "PARADE_MARCH_INFO" };
      if (/film crew|filming/i.test(transcript)) return { inferredSubIssue: "FILM_PERMIT_COMPLAINT" };
      return null;
    },
  },
  {
    intentName: "CheckServiceRequestStatus",
    subIssueSlotName: "ServiceStatusSubIssue",
    check: (transcript) => {
      if (/reopen/i.test(transcript)) return { inferredSubIssue: "REOPEN_CLOSED_SR" };
      if (/not done|still broken|never (came|fixed)|not fixed/i.test(transcript)) {
        return { inferredSubIssue: "ISSUE_NOT_RESOLVED" };
      }
      if (/status|check on my|where is my (request|ticket)/i.test(transcript)) {
        return { inferredSubIssue: "CHECK_SR_STATUS" };
      }
      return null;
    },
  },
];
