import { useCallback, useEffect, useState } from "react";
import {
  AppleClusterMarker,
  AppleLocationMarker,
  AppleResponderMarker,
  HybridMapView,
  type MapKitMapInstance,
} from "rapid-cortex-maps";

type Incident =
  | {
      id: string;
      type: "pinpoint";
      data: {
        lat: number;
        lon: number;
        accuracy: number;
        confidence: "high" | "medium" | "low";
        title: string;
      };
    }
  | {
      id: string;
      type: "surge";
      data: {
        clusterId: string;
        lat: number;
        lon: number;
        callCount: number;
        incidentType: string;
        priority: "critical" | "high" | "medium" | "low";
      };
    }
  | {
      id: string;
      type: "responder";
      data: {
        unitId: string;
        lat: number;
        lon: number;
        type: "police" | "fire" | "ems" | "supervisor";
        callsign: string;
        status: "available" | "enroute" | "onscene" | "unavailable";
      };
    };

const MOCK_INCIDENTS: Incident[] = [
  {
    id: "pin-1",
    type: "pinpoint",
    data: {
      lat: 27.3364,
      lon: -82.5306,
      accuracy: 15,
      confidence: "high",
      title: "Caller +1555***1234",
    },
  },
  {
    id: "surge-1",
    type: "surge",
    data: {
      clusterId: "CLU-001",
      lat: 27.34,
      lon: -82.54,
      callCount: 8,
      incidentType: "Vehicle crash",
      priority: "high",
    },
  },
  {
    id: "resp-1",
    type: "responder",
    data: {
      unitId: "PD-12",
      lat: 27.335,
      lon: -82.535,
      type: "police",
      callsign: "PD-12",
      status: "enroute",
    },
  },
];

export function DesktopIncidentMap() {
  const [map, setMap] = useState<MapKitMapInstance | null>(null);
  const [incidents] = useState(MOCK_INCIDENTS);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  const getMapKitToken = useCallback(async () => {
    const response = await window.electronAPI?.getMapKitToken();
    if (!response?.success || !response.token) {
      throw new Error(response?.error ?? "Failed to get MapKit token");
    }
    return response.token;
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return (
    <div className="h-full flex">
      <div className="flex-1 relative min-h-0">
        <HybridMapView
          className="h-full"
          center={{ lat: 27.3364, lng: -82.5306 }}
          zoom={13}
          preferAppleMaps
          isMac={window.electronAPI?.isMac ?? false}
          isMapKitAvailable={() => window.electronAPI?.isMapKitAvailable() ?? Promise.resolve(false)}
          getMapKitToken={getMapKitToken}
          onMapLoad={(instance) => {
            if ("setCenterAnimated" in instance) {
              setMap(instance as MapKitMapInstance);
            }
          }}
        />

        {map &&
          incidents.map((incident) => {
            if (incident.type === "pinpoint") {
              return (
                <AppleLocationMarker
                  key={incident.id}
                  map={map}
                  latitude={incident.data.lat}
                  longitude={incident.data.lon}
                  accuracy={incident.data.accuracy}
                  confidence={incident.data.confidence}
                  title={incident.data.title}
                />
              );
            }
            if (incident.type === "surge") {
              return (
                <AppleClusterMarker
                  key={incident.id}
                  map={map}
                  clusterId={incident.data.clusterId}
                  latitude={incident.data.lat}
                  longitude={incident.data.lon}
                  callCount={incident.data.callCount}
                  incidentType={incident.data.incidentType}
                  priority={incident.data.priority}
                />
              );
            }
            return (
              <AppleResponderMarker
                key={incident.id}
                map={map}
                unitId={incident.data.unitId}
                latitude={incident.data.lat}
                longitude={incident.data.lon}
                type={incident.data.type}
                callsign={incident.data.callsign}
                status={incident.data.status}
              />
            );
          })}

        {!isOnline && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium shadow-lg">
            Offline — cached tiles may still be available
          </div>
        )}
      </div>

      <aside className="w-80 border-l border-slate-700 bg-slate-900 overflow-y-auto p-4">
        <h3 className="text-lg font-bold mb-4">Active incidents</h3>
        <ul className="space-y-2 list-none m-0 p-0">
          {incidents.map((incident) => (
            <li
              key={incident.id}
              className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm"
            >
              <div className="font-medium capitalize">{incident.type}</div>
              <div className="text-slate-400 mt-1">
                {incident.type === "pinpoint" && incident.data.title}
                {incident.type === "surge" &&
                  `${incident.data.callCount} calls — ${incident.data.incidentType}`}
                {incident.type === "responder" &&
                  `${incident.data.callsign} — ${incident.data.status}`}
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
