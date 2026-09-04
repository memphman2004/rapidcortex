import { redirectToHospitalPortal } from "../_lib/redirect-to-hospital-portal";

export default async function HospitalStaffLegacyPage() {
  await redirectToHospitalPortal("/hospital-staff/dashboard");
}
