/**
 * 311 category disambiguation — infers SubIssue slots from the caller transcript.
 * Used by the existing dialog hook; does not replace the 911 safety gate.
 */

export type DisambiguationResult = {
  inferredSubIssue?: string;
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
      if (/pothole|hole in the (road|street)/i.test(transcript)) return { inferredSubIssue: "POTHOLE" };
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
];
