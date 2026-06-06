#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:?Usage: $0 <env>}"
REGION="${AWS_REGION:-us-east-1}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/hospital/sam-tables.sh
source "${SCRIPT_DIR}/sam-tables.sh"
resolve_hospital_tables "${ENVIRONMENT}"

AGENCY_ID="${HOSPITAL_AGENCY_ID}"
NOW="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
TTL="$(( $(date +%s) + 86400 * 7 ))"

echo "🌱 Seeding hospital data (SAM tables)"
echo "   Profiles: ${HOSPITAL_PROFILES_TABLE}"
echo "   Capacity: ${HOSPITAL_CAPACITY_TABLE}"
echo "   Agency:   ${AGENCY_ID}"

seed_profile() {
  local hospital_id=$1
  local name=$2
  local address=$3
  local lat=$4
  local lon=$5
  local trauma_level=$6
  local stroke=$7
  local cardiac=$8

  echo "  Profile ${name}..."

  aws dynamodb put-item \
    --table-name "${HOSPITAL_PROFILES_TABLE}" \
    --region "${REGION}" \
    --item "{
      \"pk\": {\"S\": \"AGENCY#${AGENCY_ID}\"},
      \"sk\": {\"S\": \"HOSPITAL#${hospital_id}\"},
      \"gsi1pk\": {\"S\": \"CAPABILITIES\"},
      \"gsi1sk\": {\"S\": \"TRAUMA#${trauma_level}#${name}\"},
      \"hospitalId\": {\"S\": \"${hospital_id}\"},
      \"agencyId\": {\"S\": \"${AGENCY_ID}\"},
      \"name\": {\"S\": \"${name}\"},
      \"address\": {\"S\": \"${address}\"},
      \"coordinates\": {
        \"M\": {
          \"latitude\": {\"N\": \"${lat}\"},
          \"longitude\": {\"N\": \"${lon}\"}
        }
      },
      \"phone\": {\"S\": \"(941) 555-0100\"},
      \"emergencyDepartmentPhone\": {\"S\": \"(941) 555-0101\"},
      \"traumaLevel\": {\"S\": \"${trauma_level}\"},
      \"strokeCenter\": {\"BOOL\": ${stroke}},
      \"cardiacCenter\": {\"BOOL\": ${cardiac}},
      \"pediatricCapable\": {\"BOOL\": true},
      \"burnCenter\": {\"BOOL\": false},
      \"behavioralHealthCapable\": {\"BOOL\": false},
      \"preferredNotificationMethod\": {\"S\": \"SECURE_DASHBOARD\"},
      \"active\": {\"BOOL\": true},
      \"createdAt\": {\"S\": \"${NOW}\"},
      \"updatedAt\": {\"S\": \"${NOW}\"}
    }" >/dev/null
}

seed_capacity() {
  local hospital_id=$1

  echo "  Capacity ${hospital_id}..."

  aws dynamodb put-item \
    --table-name "${HOSPITAL_CAPACITY_TABLE}" \
    --region "${REGION}" \
    --item "{
      \"pk\": {\"S\": \"AGENCY#${AGENCY_ID}\"},
      \"sk\": {\"S\": \"CAPACITY#${hospital_id}#${NOW}\"},
      \"ttl\": {\"N\": \"${TTL}\"},
      \"hospitalId\": {\"S\": \"${hospital_id}\"},
      \"agencyId\": {\"S\": \"${AGENCY_ID}\"},
      \"timestamp\": {\"S\": \"${NOW}\"},
      \"availability\": {
        \"M\": {
          \"erBeds\": {
            \"M\": {
              \"total\": {\"N\": \"25\"},
              \"occupied\": {\"N\": \"18\"},
              \"available\": {\"N\": \"7\"}
            }
          },
          \"icuBeds\": {
            \"M\": {
              \"total\": {\"N\": \"12\"},
              \"occupied\": {\"N\": \"8\"},
              \"available\": {\"N\": \"4\"}
            }
          }
        }
      },
      \"waitTimes\": {
        \"M\": {
          \"erWaitMinutes\": {\"N\": \"22\"}
        }
      },
      \"diversion\": {
        \"M\": {
          \"isOnDiversion\": {\"BOOL\": false}
        }
      },
      \"staffing\": {
        \"M\": {
          \"adequateStaffing\": {\"BOOL\": true}
        }
      },
      \"dataQuality\": {
        \"M\": {
          \"source\": {\"S\": \"MOCK\"},
          \"lastVerified\": {\"S\": \"${NOW}\"},
          \"confidence\": {\"S\": \"HIGH\"}
        }
      }
    }" >/dev/null
}

seed_profile "HOSP-001" "Sarasota Memorial Hospital" "1700 S Tamiami Trl, Sarasota, FL 34239" "27.3364" "-82.5306" "LEVEL_1" "true" "true"
seed_capacity "HOSP-001"

seed_profile "HOSP-002" "Doctors Hospital of Sarasota" "5731 Bee Ridge Rd, Sarasota, FL 34233" "27.3128" "-82.5098" "LEVEL_3" "true" "true"
seed_capacity "HOSP-002"

seed_profile "HOSP-003" "Blake Medical Center" "2020 59th St W, Bradenton, FL 34209" "27.4989" "-82.5754" "LEVEL_2" "true" "true"
seed_capacity "HOSP-003"

echo ""
echo "✅ Seeded 3 hospital profiles + capacity snapshots"
