#!/usr/bin/env bash
# Table names from infra/nested/stack-app-sam-2-hospital.yaml (AppSamHospitalStack2).
resolve_hospital_tables() {
  local env="${1:?env required}"
  HOSPITAL_PROFILES_TABLE="rapid-cortex-hospital-profiles-${env}"
  HOSPITAL_CAPACITY_TABLE="rapid-cortex-hospital-capacity-${env}"
  HOSPITAL_PREALERTS_TABLE="rapid-cortex-hospital-prealerts-${env}"
}

# Default dev agency for Sarasota-area seed data (matches legacy hospital scripts).
HOSPITAL_AGENCY_ID="${HOSPITAL_AGENCY_ID:-sarasota-county}"
