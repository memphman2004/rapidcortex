import { RecentUpdatesPanel } from "@/components/hospital-routing/recent-updates-panel";

export default function HospitalStaffHistoryPage() {
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-lg font-semibold text-white">Recent capacity updates</h1>
      <RecentUpdatesPanel />
    </div>
  );
}
