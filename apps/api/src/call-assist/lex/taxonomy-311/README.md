# Call Assist — 311 Non-Emergency Lex V2 Full Schema

## File Structure

```
src/lex/call-assist/
├── types.ts                    TypeScript interfaces for the entire schema
├── slot-types/
│   └── index.ts                All 24 custom slot type definitions (390+ slot values)
├── intents/
│   └── index.ts                All 22 intent definitions + FallbackIntent guidance
├── handlers/
│   ├── dialog-code-hook.ts     Lambda — disambiguation, escalation, routing override
│   └── fulfillment.ts          Lambda — DynamoDB SR write, SNS routing, SMS confirmation
├── build-bot.ts                AWS SDK v3 builder script — upserts everything
└── README.md                   This file
```

## Intent Count

| # | Intent Name | Category | Department | Slots |
|---|-------------|----------|------------|-------|
| 1  | ReportRoadsInfrastructure        | ROADS_INFRASTRUCTURE            | PUBLIC_WORKS              | 6 |
| 2  | ReportStreetLighting             | STREET_LIGHTING                 | PUBLIC_WORKS_ELECTRICAL   | 5 |
| 3  | ReportTrafficSignsMarkings       | TRAFFIC_SIGNS_MARKINGS          | PUBLIC_WORKS              | 5 |
| 4  | ReportSanitationWaste            | SANITATION_WASTE                | SANITATION                | 5 |
| 5  | ReportWaterSewerDrainage         | WATER_SEWER_DRAINAGE            | WATER_SEWER_AUTHORITY     | 5 |
| 6  | ReportNoiseComplaint             | NOISE_COMPLAINT                 | CODE_ENFORCEMENT          | 5 |
| 7  | ReportVehicleIssue               | ABANDONED_ILLEGAL_VEHICLES      | PARKING_ENFORCEMENT       | 6 |
| 8  | ReportGraffitiVandalism          | GRAFFITI_VANDALISM              | PUBLIC_WORKS              | 5 |
| 9  | ReportAnimalsPests               | ANIMALS_PESTS                   | ANIMAL_CONTROL            | 6 |
| 10 | ReportTreesVegetation            | TREES_VEGETATION                | URBAN_FORESTRY            | 5 |
| 11 | ReportParksPublicSpaces          | PARKS_PUBLIC_SPACES             | PARKS_RECREATION          | 6 |
| 12 | ReportBuildingsHousing           | BUILDINGS_HOUSING               | CODE_ENFORCEMENT          | 6 |
| 13 | ReportHomelessSocialServices     | HOMELESS_SOCIAL_SERVICES        | SOCIAL_SERVICES           | 4 |
| 14 | ReportEnvironmentalHealth        | ENVIRONMENTAL_HEALTH            | ENVIRONMENTAL_QUALITY     | 5 |
| 15 | ReportLawEnforcementNonEmergency | LAW_ENFORCEMENT_NON_EMERGENCY   | POLICE_NON_EMERGENCY      | 5 |
| 16 | ReportFireEMSNonEmergency        | FIRE_EMS_NON_EMERGENCY          | FIRE_MARSHAL_NON_EMERGENCY| 5 |
| 17 | ReportTransitIssue               | TRANSIT_TRANSPORTATION          | TRANSIT_AUTHORITY         | 5 |
| 18 | RequestGovernmentInformation     | GOVERNMENT_INFORMATION          | THREE11_OPERATIONS        | 3 |
| 19 | ReportSpecialEventIssue          | SPECIAL_EVENTS_PERMITS          | THREE11_OPERATIONS        | 4 |
| 20 | CheckServiceRequestStatus        | SERVICE_REQUEST_STATUS          | THREE11_OPERATIONS        | 3 |
| 21 | TransferToLiveAgent              | — (fast path)                   | THREE11_OPERATIONS        | 0 |
| 22 | RedirectToEmergencyServices      | — (escalation)                  | ESCALATE_911              | 0 |

## Slot Types

| Slot Type Name               | Values | Description |
|------------------------------|--------|-------------|
| CA_UrgencyLevel              |   5    | Caller urgency classification |
| CA_LocationType              |  10    | Type of location |
| CA_PropertyOwnership         |   4    | Public vs private property context |
| CA_IsOngoing                 |   4    | Whether issue is current, chronic, or past |
| CA_Roads_SubIssue            |  21    | Roads & infrastructure disambiguation |
| CA_Lighting_SubIssue         |  15    | Street lighting & signal disambiguation |
| CA_Signs_SubIssue            |  14    | Traffic signs & markings disambiguation |
| CA_Sanitation_SubIssue       |  24    | Sanitation & waste disambiguation |
| CA_Water_SubIssue            |  19    | Water, sewer & drainage disambiguation |
| CA_Noise_SubIssue            |  17    | Noise complaint disambiguation |
| CA_Vehicles_SubIssue         |  19    | Vehicle complaint disambiguation |
| CA_Graffiti_SubIssue         |  15    | Graffiti & vandalism disambiguation |
| CA_Animals_SubIssue          |  22    | Animal & pest disambiguation |
| CA_Trees_SubIssue            |  16    | Tree & vegetation disambiguation |
| CA_Parks_SubIssue            |  20    | Parks & public spaces disambiguation |
| CA_Buildings_SubIssue        |  23    | Buildings & housing disambiguation |
| CA_Homeless_SubIssue         |  11    | Homeless & social services disambiguation |
| CA_Environmental_SubIssue    |  16    | Environmental & health disambiguation |
| CA_LawEnforcement_SubIssue   |  18    | Law enforcement non-emergency disambiguation |
| CA_FireEMS_SubIssue          |  11    | Fire & EMS non-emergency disambiguation |
| CA_Transit_SubIssue          |  20    | Transit & transportation disambiguation |
| CA_GovInfo_SubIssue          |  27    | Government information disambiguation |
| CA_SpecialEvents_SubIssue    |  10    | Special events disambiguation |
| CA_ServiceStatus_SubIssue    |   7    | Service request status disambiguation |

**Total: 390+ custom slot values across 24 slot types**

## Build Instructions

```bash
# Prerequisites
npm install @aws-sdk/client-lex-models-v2 @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb \
            @aws-sdk/client-sns @aws-sdk/client-pinpoint-sms-voice-v2

# Set environment
export BOT_ID=your-lex-bot-id
export AWS_PROFILE=rc-aws
export AWS_REGION=us-east-1

# Dry run first
DRY_RUN=true npx ts-node build-bot.ts

# Full build
npx ts-node build-bot.ts

# Build only specific intents (for incremental updates)
INTENT_FILTER=ReportRoadsInfrastructure,ReportNoiseComplaint npx ts-node build-bot.ts
```

## Dialog Code Hook Architecture

The dialog Lambda fires on every turn. Priority order:
1. Emergency redirect intent → fast path to 911 close
2. Global escalation keyword scan → redirect to 911 if active event
3. Disambiguation rules → infer or ask targeted question for sub-issue
4. Sub-issue → department routing override (stored in session attributes)
5. Address sanity check
6. Caller impatience / suppress optional slots
7. Delegate to Lex

## Fulfillment Flow

1. All required slots filled + caller confirmed
2. Extract all slot values + session context
3. Generate SR-YYYYMMDD-XXXXXX service request ID
4. Write to DynamoDB with GSI for department-based querying
5. Publish to SNS with department + priority message attributes
6. Send SMS confirmation if callbackNumber slot is filled
7. Return confirmation message with SR number

## Department Routing

Some intents use conditional routing where the department depends on the sub-issue:

| Intent | SubIssue | Department |
|--------|----------|-----------|
| ReportNoiseComplaint | DOG_BARKING | ANIMAL_CONTROL |
| ReportNoiseComplaint | PERMITTED_EVENT_NOISE | THREE11_OPERATIONS |
| ReportAnimalsPests | RODENT_INFESTATION | SANITATION |
| ReportAnimalsPests | MOSQUITO_* | ENVIRONMENTAL_QUALITY |
| ReportBuildingsHousing | NO_HEAT_TENANT | HOUSING_COMMUNITY_DEV |
| ReportBuildingsHousing | LEAD_PAINT_CONCERN | ENVIRONMENTAL_QUALITY |
| ReportWaterSewerDrainage | WATER_BILL_DISPUTE | THREE11_OPERATIONS |
| ReportTransitIssue | PARKING_* / TOW_* | PARKING_ENFORCEMENT |
| ReportEnvironmentalHealth | RESTAURANT_SANITATION | CODE_ENFORCEMENT |

