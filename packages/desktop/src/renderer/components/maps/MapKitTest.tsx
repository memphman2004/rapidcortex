import { useCallback, useEffect, useState } from "react";
import {
  AppleLocationMarker,
  AppleMapView,
  type MapKitMapInstance,
} from "rapid-cortex-maps";

export function MapKitTest() {
  const [map, setMap] = useState<MapKitMapInstance | null>(null);
  const [mapKitAvailable, setMapKitAvailable] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<{
    success: boolean;
    token?: string;
    error?: string;
  } | null>(null);

  const getMapKitToken = useCallback(async () => {
    const response = await window.electronAPI?.getMapKitToken();
    if (!response?.success || !response.token) {
      throw new Error(response?.error ?? "Failed to get MapKit token");
    }
    return response.token;
  }, []);

  useEffect(() => {
    const checkStatus = async () => {
      if (!window.electronAPI) {
        setTokenInfo({ success: false, error: "Electron API not available" });
        return;
      }

      const available = await window.electronAPI.isMapKitAvailable();
      setMapKitAvailable(available && window.electronAPI.isMac);
      const tokenResponse = await window.electronAPI.getMapKitToken();
      setTokenInfo(tokenResponse);
    };

    void checkStatus();
  }, []);

  return (
    <div className="h-full flex flex-col">
      <header className="border-b border-slate-700 bg-slate-900 px-4 py-3">
        <h1 className="text-xl font-bold">MapKit JS Test</h1>
        <dl className="mt-2 grid gap-1 text-sm text-slate-400">
          <div>
            Platform:{" "}
            <span className="text-white">{window.electronAPI?.platform ?? "unknown"}</span>
          </div>
          <div>
            Is Mac:{" "}
            <span className="text-white">{window.electronAPI?.isMac ? "Yes" : "No"}</span>
          </div>
          <div>
            MapKit available:{" "}
            <span className={mapKitAvailable ? "text-emerald-400" : "text-red-400"}>
              {mapKitAvailable ? "Yes" : "No"}
            </span>
          </div>
          {tokenInfo && (
            <div>
              Token:{" "}
              <span className={tokenInfo.success ? "text-emerald-400" : "text-red-400"}>
                {tokenInfo.success ? "Valid" : tokenInfo.error}
              </span>
            </div>
          )}
        </dl>
      </header>

      <main className="relative flex-1 min-h-0">
        {mapKitAvailable ? (
          <AppleMapView
            className="h-full"
            center={{ lat: 27.3364, lng: -82.5306 }}
            zoom={14}
            getMapKitToken={getMapKitToken}
            onMapLoad={setMap}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <div>
              <p className="text-lg font-semibold">Apple Maps not available</p>
              <p className="mt-2 max-w-md text-sm text-slate-400">
                {tokenInfo?.error ??
                  "Configure .env.mapkit and AuthKey_*.p8 under packages/desktop, then run on macOS."}
              </p>
            </div>
          </div>
        )}

        {map && (
          <AppleLocationMarker
            map={map}
            latitude={27.3364}
            longitude={-82.5306}
            accuracy={25}
            confidence="high"
            title="Test Location"
          />
        )}
      </main>
    </div>
  );
}
