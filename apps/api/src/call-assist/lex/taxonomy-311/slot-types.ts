/**
 * Call Assist — Custom Slot Type Registry
 *
 * Each category intent has one SubIssueType slot using a category-specific
 * custom slot type. Common slots (address, urgency, etc.) are shared across all intents.
 *
 * Naming convention: CA_<CATEGORY>_SubIssue, CA_<SHARED>
 */

import type { CustomSlotTypeDefinition } from './types.js';

// ─── Common / Shared Slot Types ───────────────────────────────────────────────

export const CA_UrgencyLevel: CustomSlotTypeDefinition = {
  name: 'CA_UrgencyLevel',
  description: 'Caller-expressed urgency level for service request triage',
  resolutionStrategy: 'TOP_RESOLUTION',
  values: [
    { value: 'BLOCKING_ACCESS', synonyms: ['blocking my driveway', 'blocking the road', 'cant get through', 'no access'] },
    { value: 'SAFETY_HAZARD',   synonyms: ['dangerous', 'unsafe', 'hazardous', 'risk', 'injury', 'could hurt someone'] },
    { value: 'FLOODING',        synonyms: ['flooding', 'water everywhere', 'water in my house', 'water coming in'] },
    { value: 'STANDARD',        synonyms: ['not urgent', 'whenever you can', 'not an emergency', 'just letting you know'] },
    { value: 'INFO_ONLY',       synonyms: ['just a question', 'just need information', 'just asking'] },
  ],
};

export const CA_LocationType: CustomSlotTypeDefinition = {
  name: 'CA_LocationType',
  description: 'Type of location where the issue is occurring',
  resolutionStrategy: 'TOP_RESOLUTION',
  values: [
    { value: 'RESIDENTIAL_STREET', synonyms: ['my street', 'my neighborhood', 'residential area', 'subdivision'] },
    { value: 'COMMERCIAL_AREA',    synonyms: ['business district', 'shopping area', 'commercial street', 'downtown'] },
    { value: 'ALLEY',              synonyms: ['back alley', 'behind my house', 'the alley'] },
    { value: 'HIGHWAY',            synonyms: ['highway', 'major road', 'boulevard', 'avenue', 'freeway'] },
    { value: 'PARK',               synonyms: ['city park', 'public park', 'greenway', 'recreation area'] },
    { value: 'SCHOOL_ZONE',        synonyms: ['near the school', 'school area', 'school zone'] },
    { value: 'TRANSIT_STOP',       synonyms: ['bus stop', 'train station', 'transit station'] },
    { value: 'BRIDGE_OVERPASS',    synonyms: ['bridge', 'overpass', 'underpass', 'viaduct'] },
    { value: 'VACANT_LOT',         synonyms: ['empty lot', 'abandoned lot', 'vacant property'] },
    { value: 'SIDEWALK',           synonyms: ['sidewalk', 'footpath', 'walkway', 'pedestrian path'] },
  ],
};

export const CA_PropertyOwnership: CustomSlotTypeDefinition = {
  name: 'CA_PropertyOwnership',
  description: 'Ownership context for routing between code enforcement and public works',
  resolutionStrategy: 'TOP_RESOLUTION',
  values: [
    { value: 'PUBLIC_PROPERTY',    synonyms: ['city property', 'public', 'the city', 'city land'] },
    { value: 'MY_PROPERTY',        synonyms: ['my property', 'my yard', 'my house', 'my building'] },
    { value: 'NEIGHBORS_PROPERTY', synonyms: ["my neighbor's", 'next door', 'the house next to me', 'adjacent property'] },
    { value: 'UNKNOWN',            synonyms: ["do not know", 'not sure', 'unclear', 'unsure who owns it'] },
  ],
};

export const CA_IsOngoing: CustomSlotTypeDefinition = {
  name: 'CA_IsOngoing',
  description: 'Whether the issue is currently happening or is historical / recurring',
  resolutionStrategy: 'TOP_RESOLUTION',
  values: [
    {
      value: 'HAPPENING_NOW',
      synonyms: [
        'right now',
        'currently',
        'happening right now',
        'going on now',
        'as we speak',
        'blocking the road',
        'blocking traffic',
        'holding up traffic',
        'in the road right now',
        'still there',
        "it's there now",
        'just happened',
        'fell just now',
        'just now',
        'right now it is',
        'yes it is',
        'yes',
        'it is',
        'currently blocking',
        'active',
      ],
    },
    {
      value: 'ONGOING_CHRONIC',
      synonyms: [
        'always',
        'keeps happening',
        'chronic',
        'recurring',
        'every day',
        'every week',
        'for months',
        'been there for days',
        'been there for weeks',
        'all the time',
        'every night',
        'repeatedly',
        'been a problem',
        'long time',
      ],
    },
    {
      value: 'ALREADY_HAPPENED',
      synonyms: [
        'already happened',
        'earlier today',
        'yesterday',
        'last week',
        'after the fact',
        'it happened earlier',
        'this morning',
        'last night',
        'a while ago',
        'it was',
        'happened before',
      ],
    },
    {
      value: 'UNCERTAIN',
      synonyms: [
        'do not know',
        'not sure',
        "don't know",
        'maybe',
        'no',
        'kind of',
        'sort of',
        'maybe not',
      ],
    },
  ],
};

// ─── ROADS & INFRASTRUCTURE ───────────────────────────────────────────────────

export const CA_Roads_SubIssue: CustomSlotTypeDefinition = {
  name: 'CA_Roads_SubIssue',
  description: 'Sub-category for roads and infrastructure service requests',
  resolutionStrategy: 'TOP_RESOLUTION',
  values: [
    { value: 'POTHOLE',                  synonyms: ['hole in the road', 'big hole', 'crater in the street', 'damaged road surface'] },
    { value: 'SINKHOLE',                 synonyms: ['sinkhole', 'road is sinking', 'ground collapsing', 'road collapse'] },
    { value: 'CRACKED_PAVEMENT',         synonyms: ['cracked road', 'broken pavement', 'road is cracked', 'heaved road'] },
    { value: 'DAMAGED_SIDEWALK',         synonyms: ['broken sidewalk', 'cracked sidewalk', 'tripping hazard', 'damaged curb', 'uneven sidewalk'] },
    { value: 'MISSING_MANHOLE_COVER',    synonyms: ['missing manhole', 'open manhole', 'manhole cover gone', 'open hole in street'] },
    { value: 'RAISED_MANHOLE_COVER',     synonyms: ['manhole sticking up', 'raised manhole', 'uneven manhole', 'sunken manhole'] },
    { value: 'MISSING_GRATE',            synonyms: ['missing drain grate', 'open drain', 'grate is gone'] },
    { value: 'STREET_FLOODING',          synonyms: ['street is flooded', 'standing water on road', 'water on the street', 'road underwater'] },
    { value: 'STANDING_WATER',           synonyms: ['puddle not draining', 'water pooling', 'standing water after rain'] },
    { value: 'BRIDGE_DAMAGE',            synonyms: ['bridge is damaged', 'bridge deteriorating', 'bridge issue'] },
    { value: 'GUARDRAIL_DAMAGE',         synonyms: ['guardrail damaged', 'guardrail missing', 'highway barrier broken'] },
    { value: 'DAMAGED_CURB_CUT',         synonyms: ['damaged curb cut', 'broken ADA ramp', 'wheelchair ramp broken', 'accessibility ramp'] },
    { value: 'SNOW_ICE_REMOVAL',         synonyms: ['snow not plowed', 'ice not salted', 'street not plowed', 'need sand', 'slippery road'] },
    { value: 'ALLEY_REPAIR',             synonyms: ['alley needs repair', 'alley is broken', 'alley pavement'] },
    { value: 'ALLEY_CLEANING',           synonyms: ['dirty alley', 'alley needs cleaning', 'trash in alley'] },
    { value: 'DEBRIS_IN_ROADWAY',        synonyms: ['stuff in the road', 'debris blocking road', 'object in street', 'tree limb on road'] },
    { value: 'DEAD_ANIMAL_IN_ROAD',      synonyms: ['dead animal in street', 'dead dog in road', 'animal carcass', 'dead deer on road'] },
    { value: 'CONSTRUCTION_ZONE_ISSUE',  synonyms: ['construction blocking road', 'construction without permit', 'unauthorized lane closure'] },
    { value: 'UNLICENSED_EXCAVATION',    synonyms: ['digging in the street without permit', 'unauthorized digging', 'unmarked excavation'] },
    { value: 'ROAD_HAZARD',              synonyms: ['road hazard', 'dangerous road condition', 'road safety issue'] },
  ],
};

// ─── STREET LIGHTING ─────────────────────────────────────────────────────────

export const CA_Lighting_SubIssue: CustomSlotTypeDefinition = {
  name: 'CA_Lighting_SubIssue',
  description: 'Sub-category for street lighting and traffic signal service requests',
  resolutionStrategy: 'TOP_RESOLUTION',
  values: [
    { value: 'STREETLIGHT_OUT_SINGLE',   synonyms: ['streetlight is out', 'street lamp out', 'light not working', 'dark street'] },
    { value: 'STREETLIGHT_OUT_MULTIPLE', synonyms: ['multiple lights out', 'whole block is dark', 'several streetlights out'] },
    { value: 'STREETLIGHT_ON_DAYTIME',   synonyms: ['light on during the day', 'streetlight stays on', 'light never turns off'] },
    { value: 'STREETLIGHT_FLICKERING',   synonyms: ['flickering streetlight', 'light is flashing', 'light keeps going on and off'] },
    { value: 'DAMAGED_LIGHT_POLE',       synonyms: ['light pole is damaged', 'broken pole', 'pole was hit by car', 'bent pole'] },
    { value: 'LEANING_POLE',             synonyms: ['pole is leaning', 'tilted pole', 'pole about to fall'] },
    { value: 'EXPOSED_WIRING_ON_POLE',   synonyms: ['wires hanging from pole', 'exposed wire', 'live wire on pole'] },
    { value: 'TRAFFIC_SIGNAL_LIGHT_OUT', synonyms: ['traffic light is out', 'signal light not working', 'one light out on signal'] },
    { value: 'TRAFFIC_SIGNAL_ALL_DARK',  synonyms: ['traffic light is completely dark', 'signal not working at all', 'no lights on signal', 'intersection dark'] },
    { value: 'SIGNAL_WRONG_SEQUENCE',    synonyms: ['light not changing right', 'signal sequence wrong', 'stuck on red', 'stuck on green'] },
    { value: 'SIGNAL_TIMING_COMPLAINT',  synonyms: ['light stays red too long', 'signal timing is off', 'light changes too fast'] },
    { value: 'SIGNAL_DAMAGED',           synonyms: ['traffic signal damaged', 'signal knocked down', 'signal hit by car'] },
    { value: 'PEDESTRIAN_SIGNAL_ISSUE',  synonyms: ['walk signal not working', 'crosswalk signal broken', 'pedestrian light out'] },
    { value: 'CROSSWALK_BUTTON_BROKEN',  synonyms: ['crosswalk button broken', 'push button not working', 'pedestrian button broken'] },
    { value: 'FLASHING_LIGHT_ISSUE',     synonyms: ['flashing light not working', 'school zone light broken', 'railroad crossing light issue'] },
  ],
};

// ─── TRAFFIC SIGNS & MARKINGS ─────────────────────────────────────────────────

export const CA_Signs_SubIssue: CustomSlotTypeDefinition = {
  name: 'CA_Signs_SubIssue',
  description: 'Sub-category for traffic signs and road markings issues',
  resolutionStrategy: 'TOP_RESOLUTION',
  values: [
    { value: 'MISSING_STOP_SIGN',         synonyms: ['stop sign missing', 'stop sign gone', 'no stop sign at intersection'] },
    { value: 'MISSING_YIELD_SIGN',        synonyms: ['yield sign missing', 'no yield sign'] },
    { value: 'MISSING_STREET_SIGN',       synonyms: ['street sign missing', 'street name sign gone', 'no street name'] },
    { value: 'DAMAGED_SIGN',              synonyms: ['sign is damaged', 'bent sign', 'broken sign', 'sign was hit'] },
    { value: 'FADED_SIGN',                synonyms: ['faded sign', 'cant read the sign', 'sign not visible', 'washed out sign'] },
    { value: 'WRONG_SIGN_POSTED',         synonyms: ['wrong sign', 'incorrect sign', 'sign is wrong', 'sign in wrong location'] },
    { value: 'MISSING_SPEED_LIMIT_SIGN',  synonyms: ['speed limit sign missing', 'no speed limit posted', 'speed sign gone'] },
    { value: 'FADED_CROSSWALK',           synonyms: ['faded crosswalk', 'crosswalk not visible', 'crosswalk lines faded', 'cant see crosswalk'] },
    { value: 'FADED_LANE_MARKINGS',       synonyms: ['lane markings faded', 'cant see the lanes', 'road lines faded', 'center line faded'] },
    { value: 'MISSING_BIKE_LANE_MARKING', synonyms: ['bike lane markings faded', 'bike lane not marked', 'missing bike lane paint'] },
    { value: 'MISSING_SCHOOL_ZONE_MARKS', synonyms: ['school zone markings faded', 'school zone not visible', 'school zone lines'] },
    { value: 'MISSING_NO_PARKING_MARKS',  synonyms: ['no parking markings faded', 'parking restriction not marked', 'curb markings faded'] },
    { value: 'TEMPORARY_SIGN_BLOCKING',   synonyms: ['construction sign blocking view', 'temporary sign obstruction', 'sign blocking traffic sign'] },
    { value: 'SIGN_OBSTRUCTED_BY_TREE',   synonyms: ['tree blocking sign', 'vegetation covering sign', 'cant see sign because of tree'] },
  ],
};

// ─── SANITATION & WASTE ────────────────────────────────────────────────────────

export const CA_Sanitation_SubIssue: CustomSlotTypeDefinition = {
  name: 'CA_Sanitation_SubIssue',
  description: 'Sub-category for sanitation and waste management service requests',
  resolutionStrategy: 'TOP_RESOLUTION',
  values: [
    { value: 'MISSED_GARBAGE_PICKUP',      synonyms: ['missed garbage', 'garbage not picked up', 'they skipped my trash', 'no trash pickup'] },
    { value: 'MISSED_RECYCLING_PICKUP',    synonyms: ['missed recycling', 'recycling not picked up', 'blue bin not picked up'] },
    { value: 'MISSED_BULK_PICKUP',         synonyms: ['missed bulk pickup', 'large items not picked up', 'couch not picked up', 'furniture still there'] },
    { value: 'MISSED_YARD_WASTE_PICKUP',   synonyms: ['yard waste not picked up', 'green bin missed', 'leaves not picked up', 'brush not collected'] },
    { value: 'OVERFLOWING_PUBLIC_TRASH',   synonyms: ['overflowing trash can', 'garbage can is full', 'public trash overflowing', 'park trash can full'] },
    { value: 'OVERFLOWING_RECYCLING_BIN',  synonyms: ['recycling bin full', 'public recycling overflowing'] },
    { value: 'ILLEGAL_DUMPING',            synonyms: ['someone dumped trash', 'illegal dumping', 'junk was dumped', 'garbage dumped on street'] },
    { value: 'DUMPED_FURNITURE_APPLIANCE', synonyms: ['couch dumped on street', 'mattress dumped', 'refrigerator dumped', 'appliance abandoned', 'furniture on street'] },
    { value: 'COMMERCIAL_WASTE_VIOLATION', synonyms: ['business putting trash out wrong', 'commercial waste violation', 'restaurant trash improperly set'] },
    { value: 'RECYCLING_CONTAMINATION',    synonyms: ['wrong stuff in recycling', 'recycling contaminated', 'garbage in recycle bin'] },
    { value: 'REQUEST_EXTRA_BIN',          synonyms: ['need extra trash can', 'want another bin', 'need more recycling bins'] },
    { value: 'DAMAGED_CITY_BIN',           synonyms: ['my trash can is broken', 'city bin is cracked', 'lid is broken on trash bin', 'bin is damaged'] },
    { value: 'STOLEN_CITY_BIN',            synonyms: ['my trash can was stolen', 'bin is missing', 'someone took my city bin'] },
    { value: 'DEAD_ANIMAL_PICKUP',         synonyms: ['dead animal in my yard', 'dead animal on sidewalk', 'animal carcass needs pickup'] },
    { value: 'DEAD_BIRD_PICKUP',           synonyms: ['dead bird', 'dead seagull', 'bird carcass'] },
    { value: 'DEAD_RODENT_PICKUP',         synonyms: ['dead rat', 'dead mouse', 'rodent carcass', 'dead squirrel'] },
    { value: 'COMPOSTING_INQUIRY',         synonyms: ['composting program', 'how to compost', 'composting questions', 'organic waste program'] },
    { value: 'EWASTE_DISPOSAL',            synonyms: ['where to drop electronics', 'e-waste', 'old computer', 'where to recycle TV', 'electronic recycling'] },
    { value: 'HAZARDOUS_WASTE_DISPOSAL',   synonyms: ['hazardous waste', 'paint disposal', 'chemical disposal', 'household hazmat', 'where to dump chemicals'] },
    { value: 'MEDICATION_DROPOFF',         synonyms: ['medication disposal', 'old pills', 'drug takeback', 'where to dispose prescriptions', 'medicine disposal'] },
    { value: 'TIRE_DISPOSAL',              synonyms: ['old tire disposal', 'where to drop tires', 'tire recycling'] },
    { value: 'CONSTRUCTION_DEBRIS_DUMPED', synonyms: ['construction debris dumped', 'concrete dumped', 'building materials dumped illegally'] },
    { value: 'LITTER_COMPLAINT',           synonyms: ['litter', 'trash on the sidewalk', 'public area is littered', 'garbage everywhere'] },
    { value: 'DUMPSTER_COMPLIANCE',        synonyms: ['dumpster in wrong place', 'business dumpster issue', 'overflowing commercial dumpster'] },
  ],
};

// ─── WATER, SEWER & DRAINAGE ──────────────────────────────────────────────────

export const CA_Water_SubIssue: CustomSlotTypeDefinition = {
  name: 'CA_Water_SubIssue',
  description: 'Sub-category for water, sewer and drainage service requests',
  resolutionStrategy: 'TOP_RESOLUTION',
  values: [
    { value: 'WATER_MAIN_BREAK',          synonyms: ['water main break', 'water main burst', 'water shooting up', 'geyser in street', 'water main rupture'] },
    { value: 'WATER_MAIN_LEAK',           synonyms: ['water leaking from street', 'small water leak', 'water seeping', 'wet spot in road'] },
    { value: 'LEAKING_FIRE_HYDRANT',      synonyms: ['fire hydrant leaking', 'hydrant dripping', 'water coming from hydrant'] },
    { value: 'BROKEN_FIRE_HYDRANT',       synonyms: ['fire hydrant broken', 'hydrant damaged', 'hydrant hit by car', 'hydrant knocked over'] },
    { value: 'LOW_WATER_PRESSURE',        synonyms: ['low water pressure', 'water pressure is low', 'weak water pressure', 'barely any water coming out'] },
    { value: 'NO_WATER_SERVICE',          synonyms: ['no water', 'water is off', 'lost water service', 'no water coming out of tap'] },
    { value: 'WATER_QUALITY_COLOR',       synonyms: ['brown water', 'discolored water', 'water looks dirty', 'rusty water', 'cloudy water'] },
    { value: 'WATER_QUALITY_ODOR',        synonyms: ['water smells bad', 'water smells like chlorine', 'water smells like sulfur', 'rotten egg smell from tap'] },
    { value: 'SEWER_BACKUP_PUBLIC',       synonyms: ['sewer backing up', 'sewage in street', 'sewer overflow', 'manhole overflowing with sewage'] },
    { value: 'SEWER_ODOR_COMPLAINT',      synonyms: ['sewer smell', 'sewage odor', 'smells like sewer', 'stinky drain smell outside'] },
    { value: 'OPEN_SEWER_CAP',            synonyms: ['open sewer', 'uncovered sewer', 'sewer cap missing'] },
    { value: 'STORM_DRAIN_BLOCKED',       synonyms: ['storm drain clogged', 'drain is blocked', 'drain full of leaves', 'catch basin blocked'] },
    { value: 'FLOODED_UNDERPASS',         synonyms: ['underpass is flooded', 'tunnel is flooded', 'road under bridge is flooded'] },
    { value: 'STORMWATER_RUNOFF',         synonyms: ['stormwater runoff', 'rainwater runoff', 'drainage problem', 'water runs off neighbor property'] },
    { value: 'ILLEGAL_STORM_DRAIN_DUMP',  synonyms: ['someone dumping in drain', 'chemical in storm drain', 'dumping in catch basin', 'illegal discharge drain'] },
    { value: 'IRRIGATION_LEAK_PUBLIC',    synonyms: ['sprinkler leak in park', 'public irrigation leaking', 'median sprinkler broken', 'park sprinkler issue'] },
    { value: 'FOUNTAIN_SPLASH_PAD_ISSUE', synonyms: ['fountain not working', 'splash pad broken', 'water feature not working', 'spray park issue'] },
    { value: 'WATER_METER_DISPUTE',       synonyms: ['water meter wrong', 'meter reading dispute', 'water meter reading incorrect'] },
    { value: 'WATER_BILL_DISPUTE',        synonyms: ['water bill is wrong', 'water bill too high', 'billing dispute', 'dispute my water bill'] },
  ],
};

// ─── NOISE COMPLAINTS ─────────────────────────────────────────────────────────

export const CA_Noise_SubIssue: CustomSlotTypeDefinition = {
  name: 'CA_Noise_SubIssue',
  description: 'Sub-category for noise complaint service requests',
  resolutionStrategy: 'TOP_RESOLUTION',
  values: [
    { value: 'LOUD_MUSIC_RESIDENTIAL',   synonyms: ['neighbor playing loud music', 'loud music next door', 'loud bass from house', 'stereo too loud'] },
    { value: 'LOUD_MUSIC_COMMERCIAL',    synonyms: ['bar is too loud', 'restaurant too loud', 'club music', 'nightclub noise', 'business playing loud music'] },
    { value: 'LOUD_PARTY_DAYTIME',       synonyms: ['loud party during the day', 'noisy party', 'daytime party too loud'] },
    { value: 'LOUD_PARTY_NIGHTTIME',     synonyms: ['loud party at night', 'party keeping me up', 'night party noise', 'party after midnight'] },
    { value: 'CONSTRUCTION_NOISE',       synonyms: ['construction too early', 'construction too loud', 'jackhammer early morning', 'construction noise outside hours'] },
    { value: 'COMMERCIAL_HVAC_NOISE',    synonyms: ['HVAC noise', 'generator noise', 'rooftop unit noise', 'air conditioning unit too loud', 'machinery noise business'] },
    { value: 'VEHICLE_NOISE_EXHAUST',    synonyms: ['loud car', 'loud motorcycle', 'loud exhaust', 'modified exhaust', 'car revving', 'engine noise'] },
    { value: 'CAR_ALARM',               synonyms: ['car alarm going off', 'car alarm wont stop', 'alarm keeps going off', 'vehicle alarm'] },
    { value: 'DOG_BARKING',             synonyms: ['barking dog', 'dog wont stop barking', 'neighbor dog barking all day', 'dog barking at night'] },
    { value: 'LIVESTOCK_ROOSTER_NOISE',  synonyms: ['rooster crowing', 'chickens', 'livestock noise', 'farm animals in neighborhood'] },
    { value: 'LANDSCAPING_NOISE',        synonyms: ['leaf blower too early', 'lawn mower too early', 'landscaping before hours', 'landscaping noise violation'] },
    { value: 'PILE_DRIVING',             synonyms: ['pile driving noise', 'constant banging', 'construction pile driver'] },
    { value: 'ILLEGAL_FIREWORKS',        synonyms: ['fireworks', 'illegal fireworks', 'someone shooting fireworks', 'fireworks noise'] },
    { value: 'AMPLIFIED_STREET_PERF',   synonyms: ['street performer too loud', 'amplified music outside', 'busker too loud', 'street music amplified'] },
    { value: 'ICE_CREAM_TRUCK',         synonyms: ['ice cream truck', 'ice cream truck music', 'mobile vendor noise', 'food truck music'] },
    { value: 'GARBAGE_TRUCK_HOURS',     synonyms: ['garbage truck too early', 'trash truck in middle of night', 'recycling truck noise'] },
    { value: 'PERMITTED_EVENT_NOISE',   synonyms: ['concert noise', 'festival is too loud', 'event too loud', 'outdoor concert nearby'] },
  ],
};

// ─── ABANDONED & ILLEGALLY PARKED VEHICLES ────────────────────────────────────

export const CA_Vehicles_SubIssue: CustomSlotTypeDefinition = {
  name: 'CA_Vehicles_SubIssue',
  description: 'Sub-category for abandoned and illegally parked vehicle complaints',
  resolutionStrategy: 'TOP_RESOLUTION',
  values: [
    { value: 'ABANDONED_VEHICLE_STREET',   synonyms: ['abandoned car', 'car has been there for days', 'nobody moves the car', 'junked car on street'] },
    { value: 'ABANDONED_VEHICLE_PRIVATE',  synonyms: ['abandoned car on my property', 'abandoned vehicle on private property', 'junk car in parking lot'] },
    { value: 'VEHICLE_BLOCKING_HYDRANT',   synonyms: ['car blocking fire hydrant', 'parked in front of hydrant', 'blocking the fire plug'] },
    { value: 'VEHICLE_BLOCKING_DRIVEWAY',  synonyms: ['car blocking my driveway', 'parked in front of my driveway', 'cant get out of driveway'] },
    { value: 'VEHICLE_BLOCKING_SIDEWALK',  synonyms: ['car on sidewalk', 'parked on sidewalk', 'blocking the walkway', 'vehicle on the sidewalk'] },
    { value: 'VEHICLE_IN_BUS_STOP',        synonyms: ['parked in bus stop', 'car in bus zone', 'blocking the bus stop'] },
    { value: 'VEHICLE_IN_BIKE_LANE',       synonyms: ['car parked in bike lane', 'vehicle blocking bike lane', 'parked where cyclists go'] },
    { value: 'VEHICLE_BLOCKING_CROSSWALK', synonyms: ['car blocking crosswalk', 'parked in crosswalk', 'blocking pedestrian crossing'] },
    { value: 'DOUBLE_PARKED',             synonyms: ['double parked', 'car parked in traffic lane', 'blocking traffic', 'parked in the street'] },
    { value: 'OVERSIZED_VEHICLE_RESID',   synonyms: ['semi truck in residential', 'big rig in neighborhood', 'commercial truck residential zone'] },
    { value: 'RV_CAMPER_LONG_TERM',       synonyms: ['RV parked too long', 'camper van parked forever', 'motorhome on street too long'] },
    { value: 'COMMERCIAL_TRUCK_OVERNIGHT',synonyms: ['commercial truck overnight', 'delivery truck parked overnight', 'box truck overnight residential'] },
    { value: 'VEHICLE_PARKED_ON_LAWN',    synonyms: ['car parked on grass', 'vehicle on lawn', 'car driving on lawn', 'parked on front yard'] },
    { value: 'UNLICENSED_VEHICLE',        synonyms: ['car has no plates', 'vehicle without license plate', 'unregistered vehicle'] },
    { value: 'INOPERABLE_VEHICLE',        synonyms: ['car has no tires', 'vehicle on blocks', 'car that doesnt run', 'flat tire abandoned car'] },
    { value: 'EXPIRED_REGISTRATION',      synonyms: ['expired tags', 'registration expired', 'car has old sticker', 'registration sticker old'] },
    { value: 'ILLEGAL_ACCESSIBLE_SPACE',  synonyms: ['parked in handicap spot', 'no handicap placard', 'blocking accessible parking', 'disabled space violation'] },
    { value: 'TOWING_ZONE_VIOLATION',     synonyms: ['parked in tow away zone', 'tow zone violation', 'parked where it says will be towed'] },
    { value: 'MISSING_LICENSE_PLATE',     synonyms: ['no license plate on car', 'license plate missing', 'plate removed from vehicle'] },
  ],
};

// ─── GRAFFITI & VANDALISM ─────────────────────────────────────────────────────

export const CA_Graffiti_SubIssue: CustomSlotTypeDefinition = {
  name: 'CA_Graffiti_SubIssue',
  description: 'Sub-category for graffiti and vandalism service requests',
  resolutionStrategy: 'TOP_RESOLUTION',
  values: [
    { value: 'GRAFFITI_PUBLIC_BUILDING',  synonyms: ['graffiti on city building', 'graffiti on public wall', 'city property tagged', 'spray paint on government building'] },
    { value: 'GRAFFITI_TRANSIT',          synonyms: ['graffiti on bus stop', 'graffiti on subway', 'transit graffiti', 'graffiti on train station'] },
    { value: 'GRAFFITI_BRIDGE',           synonyms: ['graffiti on bridge', 'overpass tagged', 'graffiti under bridge', 'underpass graffiti'] },
    { value: 'GRAFFITI_PRIVATE_PROPERTY', synonyms: ['graffiti on my house', 'graffiti on my building', 'spray paint on my fence', 'tagged my property'] },
    { value: 'GRAFFITI_UTILITY_BOX',      synonyms: ['graffiti on electrical box', 'utility box tagged', 'graffiti on green box', 'traffic signal box graffiti'] },
    { value: 'GRAFFITI_PARK_EQUIPMENT',   synonyms: ['graffiti in park', 'park bench tagged', 'playground graffiti', 'spray paint in park'] },
    { value: 'GANG_TAGGING',              synonyms: ['gang graffiti', 'gang tags', 'gang signs painted', 'territory marking graffiti'] },
    { value: 'VANDALIZED_PARK_EQUIPMENT', synonyms: ['park equipment broken', 'vandalized playground', 'picnic table destroyed', 'park property damaged'] },
    { value: 'VANDALIZED_BUS_SHELTER',    synonyms: ['bus shelter vandalized', 'bus stop glass broken', 'bus shelter damaged'] },
    { value: 'VANDALIZED_STREET_FURN',   synonyms: ['bench vandalized', 'street furniture destroyed', 'public seating damaged'] },
    { value: 'BROKEN_PUBLIC_BENCH',      synonyms: ['broken bench', 'park bench broken', 'public bench damaged'] },
    { value: 'BROKEN_PUBLIC_TRASH_CAN',  synonyms: ['public trash can broken', 'trash receptacle damaged', 'street garbage can broken'] },
    { value: 'VANDALIZED_BIKE_SHARE',    synonyms: ['bike share damaged', 'bike dock vandalized', 'bikeshare station broken'] },
    { value: 'VANDALIZED_PARKING_METER', synonyms: ['parking meter broken', 'meter vandalized', 'meter damaged'] },
    { value: 'VANDALIZED_PUBLIC_ART',    synonyms: ['public art vandalized', 'mural defaced', 'public sculpture damaged', 'public artwork vandalized'] },
  ],
};

// ─── ANIMALS & PESTS ──────────────────────────────────────────────────────────

export const CA_Animals_SubIssue: CustomSlotTypeDefinition = {
  name: 'CA_Animals_SubIssue',
  description: 'Sub-category for animal and pest control service requests',
  resolutionStrategy: 'TOP_RESOLUTION',
  values: [
    { value: 'STRAY_DOG_AT_LARGE',      synonyms: ['loose dog', 'dog running loose', 'stray dog', 'dog with no owner', 'dog wandering'] },
    { value: 'STRAY_CAT_COLONY',        synonyms: ['feral cats', 'stray cats', 'cat colony', 'lots of stray cats'] },
    { value: 'DOG_BITE_FOLLOWUP',       synonyms: ['dog bit me', 'dog attacked me', 'dog bite report', 'I was bitten by a dog'] },
    { value: 'VICIOUS_DOG_COMPLAINT',   synonyms: ['aggressive dog', 'threatening dog', 'dog keeps charging', 'dangerous dog', 'neighbor dog is vicious'] },
    { value: 'ANIMAL_NEGLECT',          synonyms: ['animal is being neglected', 'dog left outside all the time', 'animal looks starving', 'neglected pet'] },
    { value: 'ANIMAL_CRUELTY',          synonyms: ['animal abuse', 'someone hurting an animal', 'animal cruelty', 'animal being mistreated'] },
    { value: 'UNLICENSED_DOG',          synonyms: ['dog not licensed', 'neighbor dog has no license', 'unlicensed pet'] },
    { value: 'DOG_OFF_LEASH_VIOLATION', synonyms: ['dog off leash', 'dog not on leash', 'unleashed dog in park', 'dog running free in restricted area'] },
    { value: 'ROAMING_LIVESTOCK',       synonyms: ['loose livestock', 'cow on road', 'goat loose', 'horse loose', 'farm animal loose'] },
    { value: 'WILDLIFE_RACCOON',        synonyms: ['raccoon problem', 'raccoons in trash', 'raccoon in yard', 'nuisance raccoon'] },
    { value: 'WILDLIFE_COYOTE',         synonyms: ['coyote in neighborhood', 'coyote sighting', 'coyote near school', 'coyote threatening pets'] },
    { value: 'WILDLIFE_OTHER',          synonyms: ['fox in yard', 'opossum problem', 'deer trapped', 'wild animal issue'] },
    { value: 'INJURED_WILDLIFE',        synonyms: ['injured animal', 'hurt bird', 'wounded animal', 'animal appears injured'] },
    { value: 'SNAKE_ON_PROPERTY',       synonyms: ['snake in my yard', 'snake in my house', 'snake on porch', 'snake problem'] },
    { value: 'BEE_SWARM_PUBLIC',        synonyms: ['bee swarm', 'swarm of bees', 'beehive on public property', 'bees everywhere'] },
    { value: 'WASP_HORNET_NEST',        synonyms: ['wasp nest', 'hornet nest', 'yellow jacket nest', 'bees nest in park'] },
    { value: 'RODENT_INFESTATION',      synonyms: ['rats', 'mice', 'rodent problem', 'rat infestation', 'mouse problem', 'seeing rats outside'] },
    { value: 'RODENT_BAITING_REQUEST',  synonyms: ['need rodent bait', 'rat bait service', 'rodent control service'] },
    { value: 'MOSQUITO_STANDING_WATER', synonyms: ['mosquitoes', 'standing water breeding mosquitoes', 'mosquito problem', 'lots of mosquitoes'] },
    { value: 'MOSQUITO_CONTROL_REQUEST',synonyms: ['spray for mosquitoes', 'mosquito spraying', 'mosquito treatment request'] },
    { value: 'DEAD_ANIMAL_PICKUP',      synonyms: ['dead animal needs pickup', 'dead animal in my yard', 'animal carcass removal'] },
    { value: 'PIGEON_NUISANCE',         synonyms: ['pigeon problem', 'birds making a mess', 'pigeon infestation', 'feral birds'] },
  ],
};

// ─── TREES & VEGETATION ───────────────────────────────────────────────────────

export const CA_Trees_SubIssue: CustomSlotTypeDefinition = {
  name: 'CA_Trees_SubIssue',
  description: 'Sub-category for tree and vegetation service requests',
  resolutionStrategy: 'TOP_RESOLUTION',
  values: [
    { value: 'FALLEN_TREE_ROAD',          synonyms: ['tree fell in road', 'fallen tree blocking street', 'tree fell down', 'tree across road', 'downed tree', 'downed tree in street', 'downed tree in the road', 'tree down in the street'] },
    { value: 'FALLEN_TREE_SIDEWALK',      synonyms: ['tree on sidewalk', 'fallen tree blocking walkway', 'tree blocking path', 'downed tree on sidewalk'] },
    { value: 'DOWNED_BRANCH',             synonyms: ['large branch down', 'downed limb', 'tree branch fell', 'broken branch in road'] },
    { value: 'TREE_OVERHANGING_ROAD',     synonyms: ['tree hanging over road', 'low branches over street', 'tree touching power lines', 'tree clearance issue'] },
    { value: 'ROOTS_DAMAGING_SIDEWALK',   synonyms: ['tree roots breaking sidewalk', 'roots lifting pavement', 'tree root damage', 'roots cracking sidewalk'] },
    { value: 'DEAD_STREET_TREE',          synonyms: ['dead tree on street', 'city tree is dead', 'street tree is dying', 'dead tree needs removal'] },
    { value: 'TREE_TRIMMING_REQUEST',     synonyms: ['tree needs trimming', 'tree branches too long', 'trim the street tree', 'overgrown city tree'] },
    { value: 'TREE_REMOVAL_REQUEST',      synonyms: ['remove dead tree', 'tree needs to come down', 'tree removal request'] },
    { value: 'OVERGROWN_SIGN_COVERAGE',   synonyms: ['tree covering sign', 'bushes blocking sign', 'vegetation hiding stop sign', 'overgrown shrubs blocking sign'] },
    { value: 'OVERGROWN_SIDEWALK_BLOCK',  synonyms: ['bushes blocking sidewalk', 'overgrown shrubs on path', 'vegetation blocking walkway'] },
    { value: 'OVERGROWN_SIGHT_LINE',      synonyms: ['bushes blocking view at intersection', 'vegetation blocking traffic view', 'cant see around corner because of plants'] },
    { value: 'OVERGROWN_VACANT_LOT',      synonyms: ['overgrown empty lot', 'weeds on vacant property', 'abandoned lot overgrown', 'vegetation maintenance violation'] },
    { value: 'STUMP_GRINDING_REQUEST',    synonyms: ['stump needs to be ground', 'tree stump removal', 'old tree stump in sidewalk'] },
    { value: 'INVASIVE_SPECIES_REPORT',   synonyms: ['invasive plant', 'kudzu', 'invasive species', 'report invasive plant'] },
    { value: 'NEW_TREE_PLANTING_REQUEST', synonyms: ['want a tree planted', 'request new street tree', 'can city plant a tree', 'tree planting program'] },
    { value: 'STORM_TREE_DAMAGE',         synonyms: ['storm damaged tree', 'tree damaged by storm', 'wind damaged tree', 'hurricane damage to tree'] },
  ],
};

// ─── PARKS & PUBLIC SPACES ────────────────────────────────────────────────────

export const CA_Parks_SubIssue: CustomSlotTypeDefinition = {
  name: 'CA_Parks_SubIssue',
  description: 'Sub-category for parks and public spaces service requests',
  resolutionStrategy: 'TOP_RESOLUTION',
  values: [
    { value: 'BROKEN_PLAYGROUND_EQUIP',   synonyms: ['broken playground', 'playground equipment broken', 'swing broken', 'slide broken', 'climbing structure damaged'] },
    { value: 'UNSAFE_PLAYGROUND_SURFACE', synonyms: ['playground surface unsafe', 'hard ground under playground', 'dangerous playground surface'] },
    { value: 'PARK_LIGHT_OUT',            synonyms: ['park light out', 'park is dark', 'lighting in park not working', 'path light in park broken'] },
    { value: 'PARK_RESTROOM_LOCKED',      synonyms: ['park bathroom locked', 'restroom is locked', 'bathroom not accessible'] },
    { value: 'PARK_RESTROOM_UNSANITARY',  synonyms: ['park bathroom is disgusting', 'restroom unsanitary', 'filthy park bathroom', 'park toilet broken'] },
    { value: 'PARK_RESTROOM_VANDALIZED',  synonyms: ['park bathroom vandalized', 'park restroom destroyed', 'bathroom graffiti'] },
    { value: 'PARK_FOUNTAIN_BROKEN',      synonyms: ['park fountain not working', 'water fountain broken', 'drinking fountain in park broken'] },
    { value: 'PARK_IRRIGATION_ISSUE',     synonyms: ['park sprinkler issue', 'overwatering in park', 'park irrigation leak', 'sprinkler stays on'] },
    { value: 'PARK_OVERGROWN',            synonyms: ['park grass too high', 'park needs mowing', 'overgrown park', 'park unmowed'] },
    { value: 'COURT_SURFACE_DAMAGED',     synonyms: ['basketball court damaged', 'tennis court broken', 'cracked court surface', 'sports court needs repair'] },
    { value: 'TRAIL_DAMAGED',             synonyms: ['trail damaged', 'park path broken', 'greenway damaged', 'trail eroded', 'walking path issue'] },
    { value: 'BEACH_HAZARD',             synonyms: ['beach hazard', 'debris on beach', 'dangerous condition at beach'] },
    { value: 'DOG_IN_NON_DOG_PARK',      synonyms: ['dog where not allowed', 'dog in no-dog park', 'unleashed dog park violation'] },
    { value: 'UNAUTHORIZED_PARK_CAMPING', synonyms: ['someone camping in park', 'tent in park', 'person sleeping in park', 'camping where not allowed'] },
    { value: 'PARK_NOISE_COMPLAINT',      synonyms: ['noise in park', 'loud music in park', 'party in park too loud'] },
    { value: 'UNAUTHORIZED_PARK_EVENT',   synonyms: ['unpermitted event in park', 'large group without permit', 'unauthorized gathering park'] },
    { value: 'PARK_GATE_INACCESSIBLE',   synonyms: ['park gate locked', 'cant get into park', 'park entrance blocked'] },
    { value: 'SPLASH_PAD_NOT_WORKING',   synonyms: ['splash pad broken', 'spray park not working', 'water park feature broken'] },
    { value: 'OUTDOOR_FITNESS_DAMAGED',  synonyms: ['outdoor gym equipment broken', 'fitness station damaged', 'exercise equipment in park broken'] },
    { value: 'SKATE_PARK_DAMAGE',        synonyms: ['skate park damaged', 'skate ramp broken', 'skate park repair needed'] },
  ],
};

// ─── BUILDINGS & HOUSING ──────────────────────────────────────────────────────

export const CA_Buildings_SubIssue: CustomSlotTypeDefinition = {
  name: 'CA_Buildings_SubIssue',
  description: 'Sub-category for building and housing code service requests',
  resolutionStrategy: 'TOP_RESOLUTION',
  values: [
    { value: 'ABANDONED_BUILDING',        synonyms: ['abandoned building', 'empty building', 'vacant building', 'derelict property'] },
    { value: 'UNSECURED_VACANT_BUILDING', synonyms: ['vacant building open', 'abandoned building no doors', 'open windows on vacant building', 'break-in access to vacant building'] },
    { value: 'OVERGROWN_ABANDONED_LOT',   synonyms: ['overgrown lot', 'abandoned lot with weeds', 'vacant lot not maintained'] },
    { value: 'TRASH_ON_PRIVATE_PROP',     synonyms: ['trash on private property', 'junk accumulating at house', 'garbage piling up at neighbors'] },
    { value: 'EXTERIOR_MAINTENANCE_VIOL', synonyms: ['exterior violation', 'property maintenance issue', 'building exterior in bad shape'] },
    { value: 'CRUMBLING_EXTERIOR',        synonyms: ['building crumbling', 'facade falling apart', 'parapet crumbling', 'exterior masonry falling'] },
    { value: 'BROKEN_WINDOWS_VACANT',     synonyms: ['broken windows on building', 'broken windows vacant building', 'open windows with broken glass'] },
    { value: 'ILLEGAL_CONVERSION',        synonyms: ['illegal apartment', 'illegal basement unit', 'unauthorized dwelling', 'commercial converted to residential'] },
    { value: 'OVERCROWDING_COMPLAINT',    synonyms: ['too many people in one unit', 'overcrowded building', 'housing overcrowding'] },
    { value: 'UNPERMITTED_CONSTRUCTION',  synonyms: ['construction without permit', 'building without permit', 'unpermitted addition', 'no permit for remodel'] },
    { value: 'UNPERMITTED_DEMOLITION',    synonyms: ['demolition without permit', 'tearing down without permit', 'unauthorized demolition'] },
    { value: 'UNSAFE_FENCE_RETAINING',   synonyms: ['unsafe fence', 'retaining wall failing', 'fence about to fall', 'wall collapsing'] },
    { value: 'NO_HEAT_TENANT',           synonyms: ['no heat in my apartment', 'landlord not providing heat', 'heat is off', 'no heat and its cold', 'heating not working'] },
    { value: 'NO_HOT_WATER_TENANT',      synonyms: ['no hot water', 'landlord wont fix hot water', 'no hot water apartment'] },
    { value: 'PEST_INFESTATION_TENANT',  synonyms: ['roaches in apartment', 'rats in my unit', 'pest infestation landlord wont fix', 'bedbugs in rental'] },
    { value: 'LEAD_PAINT_CONCERN',       synonyms: ['lead paint', 'concerned about lead', 'paint chipping old building', 'possible lead paint'] },
    { value: 'MOLD_COMPLAINT',           synonyms: ['mold in apartment', 'mold problem', 'black mold', 'mold landlord wont fix', 'moisture damage mold'] },
    { value: 'UNSAFE_CONDITIONS_TENANT', synonyms: ['unsafe conditions', 'loose railing', 'broken steps', 'unsafe floor', 'structural issue in unit'] },
    { value: 'ELEVATOR_OUTAGE',          synonyms: ['elevator not working', 'elevator broken', 'elevator out of service multi-family'] },
    { value: 'BLOCKED_FIRE_ESCAPE',      synonyms: ['fire escape blocked', 'cant access fire escape', 'egress blocked', 'exit blocked'] },
    { value: 'ILLEGAL_SIGNAGE',          synonyms: ['illegal sign on building', 'unpermitted sign', 'sign violating zoning', 'sign too bright'] },
    { value: 'SCAFFOLDING_ISSUE',        synonyms: ['scaffolding improperly installed', 'scaffolding blocking sidewalk', 'unsafe scaffolding'] },
    { value: 'OUTDOOR_STORAGE_VIOLATION',synonyms: ['junk stored outside', 'outdoor storage violation', 'hoarding outside', 'items stored in yard improperly'] },
  ],
};

// ─── HOMELESS & SOCIAL SERVICES ───────────────────────────────────────────────

export const CA_Homeless_SubIssue: CustomSlotTypeDefinition = {
  name: 'CA_Homeless_SubIssue',
  description: 'Sub-category for homeless encampment and social services requests',
  resolutionStrategy: 'TOP_RESOLUTION',
  values: [
    { value: 'ENCAMPMENT_SIDEWALK',       synonyms: ['tent on sidewalk', 'homeless encampment on sidewalk', 'camp blocking sidewalk', 'tents on walkway'] },
    { value: 'ENCAMPMENT_BRIDGE',         synonyms: ['camp under the bridge', 'encampment under freeway', 'homeless under overpass', 'tents under bridge'] },
    { value: 'ENCAMPMENT_PARK',           synonyms: ['homeless in park', 'encampment in park', 'tents in the park', 'camp in public park'] },
    { value: 'ENCAMPMENT_NEAR_SCHOOL',    synonyms: ['encampment near school', 'homeless near school', 'tents near kids school'] },
    { value: 'ENCAMPMENT_TRANSIT',        synonyms: ['homeless at bus stop', 'encampment at train station', 'camp near transit stop'] },
    { value: 'INDIVIDUAL_IN_DOORWAY',     synonyms: ['person sleeping in doorway', 'homeless person blocking business entrance', 'individual in building entrance'] },
    { value: 'WELFARE_CHECK_REQUEST',     synonyms: ['welfare check', 'check on someone', 'person looks unwell', 'person appears ill outside', 'someone needs help outside'] },
    { value: 'OUTREACH_TEAM_REQUEST',     synonyms: ['send outreach', 'social worker needed', 'outreach team for homeless person', 'someone needs services'] },
    { value: 'SHARPS_DEBRIS',             synonyms: ['needles on ground', 'syringes in park', 'drug needles', 'sharps on ground', 'needles in alley'] },
    { value: 'ABANDONED_BELONGINGS',      synonyms: ['abandoned belongings', 'stuff left on sidewalk', 'belongings left in public space'] },
    { value: 'SOCIAL_SERVICE_REFERRAL',   synonyms: ['need help', 'need housing help', 'need services', 'looking for shelter', 'need assistance'] },
  ],
};

// ─── ENVIRONMENTAL & HEALTH ───────────────────────────────────────────────────

export const CA_Environmental_SubIssue: CustomSlotTypeDefinition = {
  name: 'CA_Environmental_SubIssue',
  description: 'Sub-category for environmental and public health complaints',
  resolutionStrategy: 'TOP_RESOLUTION',
  values: [
    { value: 'AIR_QUALITY_ODOR',          synonyms: ['bad smell from factory', 'chemical smell outside', 'strange odor in neighborhood', 'industrial smell'] },
    { value: 'AIR_QUALITY_SMOKE',         synonyms: ['smoke from neighbor', 'smoke blowing from facility', 'excessive smoke in area'] },
    { value: 'ILLEGAL_OPEN_BURNING',      synonyms: ['someone is burning trash', 'open fire burning refuse', 'illegal burn pile', 'burning prohibited materials'] },
    { value: 'ASBESTOS_CONCERN',          synonyms: ['asbestos concern', 'possible asbestos at demo site', 'construction with asbestos'] },
    { value: 'HAZARDOUS_SPILL_SMALL',     synonyms: ['chemical spill', 'small spill on street', 'liquid spilled on road', 'unknown substance spilled'] },
    { value: 'OIL_IN_STORM_DRAIN',        synonyms: ['oil going into drain', 'motor oil in storm drain', 'petroleum in catch basin'] },
    { value: 'FUEL_SPILL_NO_FIRE',        synonyms: ['gas spilled on ground', 'fuel spill no fire', 'gasoline on pavement'] },
    { value: 'ILLEGAL_CHEMICAL_DUMPING',  synonyms: ['chemicals dumped illegally', 'drums of chemicals dumped', 'hazardous waste dumped'] },
    { value: 'SEPTIC_OVERFLOW_PUBLIC',    synonyms: ['septic overflow on sidewalk', 'sewage overflow on ground', 'sewage on public property'] },
    { value: 'MOLD_PUBLIC_BUILDING',      synonyms: ['mold in city building', 'mold in public facility', 'mold at community center'] },
    { value: 'WATERWAY_CONCERN',          synonyms: ['pollution in creek', 'stuff dumped in river', 'waterway pollution', 'dumping near water'] },
    { value: 'STAGNANT_WATER_MOSQUITO',   synonyms: ['stagnant water', 'standing water breeding mosquitoes', 'mosquito breeding site', 'stagnant pool'] },
    { value: 'RESTAURANT_SANITATION',     synonyms: ['dirty restaurant', 'restaurant health violation', 'food safety complaint', 'restaurant sanitation issue'] },
    { value: 'UNLICENSED_FOOD_VENDOR',    synonyms: ['unlicensed food cart', 'illegal food vendor', 'food vendor without permit', 'unauthorized food truck'] },
    { value: 'GARBAGE_SMELL_BUSINESS',    synonyms: ['business smells like garbage', 'restaurant dumpster smell', 'commercial garbage odor'] },
    { value: 'DEAD_ANIMAL_ODOR',          synonyms: ['smell coming from dead animal', 'dead animal smell nearby', 'odor from carcass'] },
  ],
};

// ─── LAW ENFORCEMENT NON-EMERGENCY ────────────────────────────────────────────

export const CA_LawEnforcement_SubIssue: CustomSlotTypeDefinition = {
  name: 'CA_LawEnforcement_SubIssue',
  description: 'Sub-category for non-emergency law enforcement requests — NOT for active emergencies',
  resolutionStrategy: 'TOP_RESOLUTION',
  values: [
    { value: 'CHRONIC_DRUG_ACTIVITY',     synonyms: ['drug activity in area', 'drug dealing on corner', 'drug house', 'dealers in my neighborhood'] },
    { value: 'CHRONIC_LOITERING',         synonyms: ['people loitering', 'loitering problem', 'people hanging out blocking business', 'chronic loitering'] },
    { value: 'CHRONIC_TRESPASSING',       synonyms: ['people trespassing', 'trespassers at property', 'people keep going on private property'] },
    { value: 'CHRONIC_SPEEDING',          synonyms: ['cars speeding on my street', 'speeding problem', 'drivers going too fast', 'speeding cars in neighborhood'] },
    { value: 'RECKLESS_DRIVING_PAST',     synonyms: ['reckless driver', 'car driving dangerously', 'reckless driving already happened', 'someone drove recklessly'] },
    { value: 'ILLEGAL_STREET_RACING',     synonyms: ['street racing', 'drag racing on street', 'cars racing at night', 'racing problem area'] },
    { value: 'ILLEGAL_ATV_DIRTBIKE',      synonyms: ['ATVs in neighborhood', 'dirt bikes on street', 'illegal off-road vehicles', 'four wheelers on road'] },
    { value: 'LOUD_EXHAUST_MOD',          synonyms: ['loud exhaust', 'modified car exhaust', 'motorcycle with loud pipes', 'illegally modified exhaust'] },
    { value: 'PACKAGE_MAIL_THEFT_PAST',   synonyms: ['package was stolen', 'mail theft', 'porch pirate', 'packages stolen', 'mail was stolen'] },
    { value: 'PROPERTY_VANDALISM_PAST',   synonyms: ['vandalism to my property', 'someone vandalized my car', 'property was damaged'] },
    { value: 'PROPERTY_DISPUTE',          synonyms: ['property dispute', 'neighbor encroachment', 'fence dispute', 'property line issue'] },
    { value: 'EXTRA_PATROL_REQUEST',      synonyms: ['extra patrol', 'more police presence', 'need patrol in my area', 'increase police patrol'] },
    { value: 'POLICE_REPORT_STATUS',      synonyms: ['status of my report', 'check on my police report', 'follow up police report', 'police report status'] },
    { value: 'INVESTIGATION_STATUS',      synonyms: ['investigation status', 'what happened with my case', 'case status inquiry'] },
    { value: 'CHRONIC_NEIGHBOR_DISPUTE',  synonyms: ['ongoing neighbor dispute', 'neighbor harassing me', 'conflict with neighbor', 'ongoing conflict'] },
    { value: 'CURFEW_VIOLATION',          synonyms: ['kids out late', 'juveniles out past curfew', 'minors violating curfew'] },
    { value: 'CODE_COMPLIANCE_ENFORCE',   synonyms: ['code enforcement needed', 'property in violation', 'city code being violated', 'property code complaint'] },
    { value: 'COPPER_CATALYTIC_THEFT',    synonyms: ['catalytic converter stolen', 'copper theft area', 'metal theft problem', 'catalytic converters being stolen'] },
  ],
};

// ─── FIRE & EMS NON-EMERGENCY ─────────────────────────────────────────────────

export const CA_FireEMS_SubIssue: CustomSlotTypeDefinition = {
  name: 'CA_FireEMS_SubIssue',
  description: 'Sub-category for fire and EMS non-emergency requests',
  resolutionStrategy: 'TOP_RESOLUTION',
  values: [
    { value: 'FIRE_HAZARD_COMPLAINT',     synonyms: ['fire hazard', 'potential fire hazard', 'materials stacked near building', 'fire risk at property'] },
    { value: 'BLOCKED_FIRE_HYDRANT_VEG', synonyms: ['fire hydrant blocked by bushes', 'vegetation blocking hydrant', 'shrubs covering hydrant'] },
    { value: 'BLOCKED_FIRE_LANE',         synonyms: ['fire lane blocked', 'blocked fire access', 'car in fire lane', 'fire truck cannot get through'] },
    { value: 'ILLEGAL_FIREWORKS_STORAGE', synonyms: ['fireworks stored illegally', 'large fireworks stockpile', 'commercial fireworks stored improperly'] },
    { value: 'OUTDOOR_BURN_NO_PERMIT',    synonyms: ['burning outside without permit', 'open fire no permit', 'outdoor burning no permit', 'burn pile violation'] },
    { value: 'SMOKE_DETECTOR_REQUEST',    synonyms: ['need smoke detector', 'smoke detector installation', 'can city give me smoke detector', 'free smoke alarm'] },
    { value: 'CO_DETECTOR_INQUIRY',       synonyms: ['carbon monoxide detector', 'CO detector information', 'carbon monoxide alarm info'] },
    { value: 'FIRE_EXTINGUISHER_INFO',    synonyms: ['fire extinguisher info', 'fire extinguisher inspection', 'where to get fire extinguisher'] },
    { value: 'FIRE_SAFETY_EDUCATION',     synonyms: ['fire safety education', 'fire prevention information', 'fire safety for kids', 'fire safety class'] },
    { value: 'FIRE_STATION_INFO',         synonyms: ['fire station hours', 'fire station address', 'fire department contact', 'fire station near me'] },
    { value: 'OPEN_PIT_EXCAVATION',       synonyms: ['open pit near building', 'excavation blocking fire access', 'construction blocking fire truck path'] },
  ],
};

// ─── TRANSIT & TRANSPORTATION ─────────────────────────────────────────────────

export const CA_Transit_SubIssue: CustomSlotTypeDefinition = {
  name: 'CA_Transit_SubIssue',
  description: 'Sub-category for transit and transportation service requests',
  resolutionStrategy: 'TOP_RESOLUTION',
  values: [
    { value: 'BUS_STOP_BENCH_DAMAGED',    synonyms: ['bus stop bench broken', 'bench at bus stop broken', 'damaged bus bench'] },
    { value: 'BUS_SHELTER_DAMAGED',       synonyms: ['bus shelter damaged', 'bus shelter broken', 'transit shelter vandalized'] },
    { value: 'BUS_SHELTER_GLASS_BROKEN',  synonyms: ['bus shelter glass broken', 'glass at bus stop shattered', 'broken glass at bus stop'] },
    { value: 'BUS_STOP_SIGN_MISSING',     synonyms: ['bus stop sign missing', 'bus route sign gone', 'no bus stop sign'] },
    { value: 'REALTIME_SIGN_NOT_WORKING', synonyms: ['bus arrival sign not working', 'digital sign at bus stop broken', 'real time display not working'] },
    { value: 'BUS_LATE_CHRONIC_ROUTE',    synonyms: ['bus is always late', 'bus never on time', 'chronic bus delay', 'bus route complaint'] },
    { value: 'BUS_ROUTE_CHANGE_INQUIRY',  synonyms: ['bus route changed', 'bus route questions', 'bus schedule inquiry', 'when does bus come'] },
    { value: 'BIKE_LANE_BLOCKED',         synonyms: ['bike lane is blocked', 'debris in bike lane', 'car in bike lane blocking cyclists'] },
    { value: 'BIKE_SHARE_BROKEN',         synonyms: ['bikeshare broken', 'bike share station not working', 'city bike broken', 'bike share dock broken'] },
    { value: 'SCOOTER_SIDEWALK_BLOCKING', synonyms: ['scooter blocking sidewalk', 'electric scooter in the way', 'e-scooter obstructing path'] },
    { value: 'EBIKE_ABANDONED',           synonyms: ['electric bike abandoned', 'e-bike left in wrong place', 'abandoned e-bike blocking access'] },
    { value: 'RIDESHARE_BUS_STOP',        synonyms: ['Uber blocking bus stop', 'rideshare in bus lane', 'lyft in bus stop', 'rideshare blocking bike lane'] },
    { value: 'PARATRANSIT_SCHEDULING',    synonyms: ['paratransit problem', 'accessible transit scheduling issue', 'dial-a-ride issue', 'ADA transit complaint'] },
    { value: 'PARATRANSIT_ELIGIBILITY',   synonyms: ['paratransit eligibility', 'how to qualify for paratransit', 'ADA transit qualification'] },
    { value: 'PARKING_METER_BROKEN',      synonyms: ['parking meter broken', 'meter not working', 'cant pay parking meter', 'meter malfunction'] },
    { value: 'PARKING_PERMIT_INQUIRY',    synonyms: ['parking permit', 'residential parking permit', 'parking zone permit', 'how to get parking permit'] },
    { value: 'TOW_INQUIRY',              synonyms: ['where is my car', 'my car was towed', 'find my towed car', 'impound lot', 'car was impounded'] },
    { value: 'NO_PARKING_SIGN_DISPUTE',  synonyms: ['disagree with no parking sign', 'temporary no parking dispute', 'no parking sign was not there'] },
    { value: 'PEDESTRIAN_BRIDGE_ISSUE',  synonyms: ['pedestrian bridge broken', 'footbridge damage', 'walking bridge needs repair'] },
    { value: 'FERRY_TERMINAL_COMPLAINT', synonyms: ['ferry terminal issue', 'ferry complaint', 'boat terminal complaint'] },
  ],
};

// ─── GOVERNMENT INFORMATION & SERVICES ────────────────────────────────────────

export const CA_GovInfo_SubIssue: CustomSlotTypeDefinition = {
  name: 'CA_GovInfo_SubIssue',
  description: 'Sub-category for government information and services requests',
  resolutionStrategy: 'TOP_RESOLUTION',
  values: [
    { value: 'CITY_OFFICE_HOURS_LOCATION',synonyms: ['city hall hours', 'city office hours', 'when is city hall open', 'where is city hall'] },
    { value: 'PAYMENT_OF_FINES',          synonyms: ['pay a fine', 'how to pay ticket', 'pay city citation', 'pay parking ticket'] },
    { value: 'BUSINESS_LICENSE_APPLY',    synonyms: ['business license application', 'how to get business license', 'apply for business license'] },
    { value: 'BUSINESS_LICENSE_RENEW',    synonyms: ['renew business license', 'business license renewal', 'business license expiring'] },
    { value: 'BUSINESS_LICENSE_STATUS',   synonyms: ['business license status', 'is my license approved', 'check business license status'] },
    { value: 'CERTIFICATE_OF_OCCUPANCY',  synonyms: ['certificate of occupancy', 'CO for building', 'certificate of occupancy questions'] },
    { value: 'ZONING_INFORMATION',        synonyms: ['zoning info', 'what is this property zoned', 'zoning questions', 'land use zoning'] },
    { value: 'PERMIT_PROCESS_INFO',       synonyms: ['how to get a permit', 'permit application', 'permit process', 'what permits do I need'] },
    { value: 'BUILDING_PERMIT_STATUS',    synonyms: ['permit status', 'is my permit approved', 'check permit status', 'building permit status'] },
    { value: 'INSPECTION_SCHEDULING',     synonyms: ['schedule inspection', 'need an inspection', 'book a city inspection', 'when can inspector come'] },
    { value: 'INSPECTION_RESULT_INQUIRY', synonyms: ['inspection results', 'what was result of inspection', 'check inspection outcome'] },
    { value: 'PROPERTY_TAX_INQUIRY',      synonyms: ['property tax question', 'property tax amount', 'city property tax', 'property assessment question'] },
    { value: 'VOTER_REGISTRATION',        synonyms: ['register to vote', 'voter registration', 'am I registered to vote', 'voter registration information'] },
    { value: 'POLLING_LOCATION',          synonyms: ['where do I vote', 'my polling place', 'polling location', 'voting location'] },
    { value: 'JURY_DUTY_INQUIRY',         synonyms: ['jury duty', 'jury summons', 'jury duty questions', 'jury service inquiry'] },
    { value: 'VITAL_RECORDS_REQUEST',     synonyms: ['birth certificate', 'death certificate', 'marriage license', 'vital records', 'official records request'] },
    { value: 'PUBLIC_RECORDS_REQUEST',    synonyms: ['public records', 'FOIA request', 'open records request', 'government records request'] },
    { value: 'CITY_COUNCIL_CONTACT',      synonyms: ['city council contact', 'how to reach my council member', 'city council member', 'alderman contact'] },
    { value: 'SENIOR_SERVICES',           synonyms: ['senior services', 'elderly assistance', 'programs for seniors', 'senior center information'] },
    { value: 'DISABILITY_SERVICES',       synonyms: ['disability services', 'ADA services', 'services for disabled', 'disability assistance programs'] },
    { value: 'FOOD_ASSISTANCE',           synonyms: ['food assistance', 'food stamps', 'SNAP benefits', 'food pantry', 'emergency food help'] },
    { value: 'RENT_UTILITY_ASSISTANCE',   synonyms: ['rent assistance', 'utility assistance', 'help paying rent', 'LIHEAP', 'help with utilities', 'heating assistance'] },
    { value: 'MENTAL_HEALTH_REFERRAL',    synonyms: ['mental health services', 'counseling services', 'mental health resources', 'therapy referral'] },
    { value: 'DOMESTIC_VIOLENCE_INFO',    synonyms: ['domestic violence resources', 'shelter information', 'DV hotline', 'domestic violence services'] },
    { value: 'SUBSTANCE_ABUSE_REFERRAL',  synonyms: ['substance abuse help', 'drug addiction resources', 'alcohol treatment', 'rehab referral'] },
    { value: 'IMMIGRATION_SERVICES',      synonyms: ['immigration help', 'immigrant services', 'immigration resources', 'city services for immigrants'] },
    { value: 'LANGUAGE_ACCESS',           synonyms: ['interpreter', 'translation services', 'language help', 'need interpreter at city office', 'language access services'] },
  ],
};

// ─── SPECIAL EVENTS & PERMITS ─────────────────────────────────────────────────

export const CA_SpecialEvents_SubIssue: CustomSlotTypeDefinition = {
  name: 'CA_SpecialEvents_SubIssue',
  description: 'Sub-category for special event permit and noise complaints',
  resolutionStrategy: 'TOP_RESOLUTION',
  values: [
    { value: 'STREET_CLOSURE_INQUIRY',    synonyms: ['street closure', 'road closed for event', 'detour information', 'road closed why'] },
    { value: 'EVENT_NOISE_COMPLAINT',     synonyms: ['event too loud', 'outdoor concert too loud', 'festival noise', 'noise from permitted event'] },
    { value: 'SPECIAL_EVENT_PERMIT_APP',  synonyms: ['event permit', 'how to get event permit', 'special event application', 'permit for outdoor event'] },
    { value: 'BLOCK_PARTY_PERMIT',        synonyms: ['block party permit', 'how to close my street for party', 'neighborhood event permit'] },
    { value: 'FILM_PERMIT_COMPLAINT',     synonyms: ['movie filming complaint', 'film crew issue', 'TV production complaint', 'filming permit issue'] },
    { value: 'PARADE_MARCH_INFO',         synonyms: ['parade information', 'march information', 'parade route', 'protest march route'] },
    { value: 'VENDOR_PERMIT_EVENT',       synonyms: ['vendor at event permit', 'food vendor event', 'how to sell at event', 'event vendor permit'] },
    { value: 'FIREWORKS_PERMIT',          synonyms: ['fireworks permit', 'permit to use fireworks', 'fireworks for event'] },
    { value: 'STADIUM_TRAFFIC_COMPLAINT', synonyms: ['game day traffic', 'stadium traffic complaint', 'arena event traffic', 'sports event parking'] },
    { value: 'TEMP_STRUCTURE_PERMIT',     synonyms: ['tent permit', 'temporary structure permit', 'stage permit', 'scaffolding event permit'] },
  ],
};

// ─── SERVICE REQUEST STATUS ───────────────────────────────────────────────────

export const CA_ServiceStatus_SubIssue: CustomSlotTypeDefinition = {
  name: 'CA_ServiceStatus_SubIssue',
  description: 'Sub-category for service request status and follow-up',
  resolutionStrategy: 'TOP_RESOLUTION',
  values: [
    { value: 'CHECK_SR_STATUS',           synonyms: ['check my request', 'status of my request', 'what happened with my complaint', 'track my service request'] },
    { value: 'REOPEN_CLOSED_SR',          synonyms: ['reopen my request', 'issue not resolved', 'my request was closed but not fixed', 'reopen complaint'] },
    { value: 'ISSUE_NOT_RESOLVED',        synonyms: ['problem still there', 'not fixed', 'they came but didnt fix it', 'issue persists'] },
    { value: 'ESCALATE_REQUEST',          synonyms: ['escalate my complaint', 'need supervisor', 'want to escalate', 'this needs escalation'] },
    { value: 'DUPLICATE_REQUEST_INQUIRY', synonyms: ['did you already get my call', 'duplicate request', 'already reported this', 'I called about this before'] },
    { value: 'CORRECT_ADDRESS_ON_SR',     synonyms: ['wrong address on my request', 'fix the address', 'address was wrong on my complaint'] },
    { value: 'GET_SR_CONFIRMATION_NUM',   synonyms: ['confirmation number', 'my request number', 'service request number', 'need my case number'] },
  ],
};

// ─── Master Registry ──────────────────────────────────────────────────────────

export const ALL_SLOT_TYPES: CustomSlotTypeDefinition[] = [
  // Common
  CA_UrgencyLevel,
  CA_LocationType,
  CA_PropertyOwnership,
  CA_IsOngoing,
  // Category-specific
  CA_Roads_SubIssue,
  CA_Lighting_SubIssue,
  CA_Signs_SubIssue,
  CA_Sanitation_SubIssue,
  CA_Water_SubIssue,
  CA_Noise_SubIssue,
  CA_Vehicles_SubIssue,
  CA_Graffiti_SubIssue,
  CA_Animals_SubIssue,
  CA_Trees_SubIssue,
  CA_Parks_SubIssue,
  CA_Buildings_SubIssue,
  CA_Homeless_SubIssue,
  CA_Environmental_SubIssue,
  CA_LawEnforcement_SubIssue,
  CA_FireEMS_SubIssue,
  CA_Transit_SubIssue,
  CA_GovInfo_SubIssue,
  CA_SpecialEvents_SubIssue,
  CA_ServiceStatus_SubIssue,
];

export const SLOT_TYPE_NAME_MAP: Record<string, CustomSlotTypeDefinition> = 
  Object.fromEntries(ALL_SLOT_TYPES.map(st => [st.name, st]));
