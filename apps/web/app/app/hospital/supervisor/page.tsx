import { redirectToHospitalPortal } from "../_lib/redirect-to-hospital-portal";

export default async function HospitalSupervisorLegacyPage() {
  await redirectToHospitalPortal("/hospital-admin/dashboard");
}
