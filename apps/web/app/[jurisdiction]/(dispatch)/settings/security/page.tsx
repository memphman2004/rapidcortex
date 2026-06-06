import { ChangePasswordForm } from "@/components/auth/change-password-form";

export default function SecuritySettingsPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <ChangePasswordForm showFullPageCopy={false} />
    </div>
  );
}
