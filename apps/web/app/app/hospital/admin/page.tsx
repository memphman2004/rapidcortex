import { redirectToHospitalPortal } from "../_lib/redirect-to-hospital-portal";

export default async function HospitalAdminLegacyPage() {
  await redirectToHospitalPortal("/hospital-admin/dashboard");
}
