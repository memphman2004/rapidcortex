"use client";

import { useSession } from "@/components/auth/session-context";
import { CameraProviderSetup } from "@/components/cameras/CameraProviderSetup";
import { NestCameraPanel } from "@/components/cameras/NestCameraPanel";
import { WyzeCameraPanel } from "@/components/cameras/WyzeCameraPanel";
import { NEST_TM, WYZE_TM, joinTrademarkList } from "@/lib/brand-marks";
import { isNestEnabled } from "@/lib/nest-feature-flags";
import { isWyzeEnabled } from "@/lib/wyze-feature-flags";

export function VenueCamerasClient({ venueCode }: { venueCode: string }) {
  const { user } = useSession();

  const nestEnabled = isNestEnabled();
  const wyzeEnabled = isWyzeEnabled();

  if (!user) {
    return <p className="text-sm text-slate-400">Sign in to manage venue cameras.</p>;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Cameras</h1>
        <p className="mt-1 text-sm text-slate-400">
          Register venue RTSP / ONVIF cameras for KVS streaming above, then link{" "}
          {joinTrademarkList([nestEnabled && NEST_TM, wyzeEnabled && WYZE_TM])}{" "}
          accounts for emergency collaboration during incidents.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {nestEnabled ? (
          <section className="space-y-3 rounded-lg border border-emerald-500/30 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-emerald-200">{NEST_TM}</h2>
            <CameraProviderSetup />
            <NestCameraPanel
              agencyId={user.agencyId}
              incidentId={null}
              connectSettingsHref={`/app/venue/${venueCode}/cameras`}
            />
          </section>
        ) : null}

        {wyzeEnabled ? (
          <section className="space-y-3 rounded-lg border border-cyan-500/30 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-cyan-200">{WYZE_TM}</h2>
            <WyzeCameraPanel agencyId={user.agencyId} incidentId={null} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
