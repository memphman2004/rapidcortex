import { redirectToHospitalPortal } from "../_lib/redirect-to-hospital-portal";

export default async function HospitalCoordinatorLegacyPage() {
  await redirectToHospitalPortal("/hospital-admin/dashboard");
}
