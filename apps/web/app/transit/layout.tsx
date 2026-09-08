import { VerticalAlertOverlay } from "@/components/alerts/vertical-alert-overlay";

export default function TransitCodeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-vertical="transit">
      <VerticalAlertOverlay />
      {children}
    </div>
  );
}
