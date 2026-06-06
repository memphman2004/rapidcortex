"use client";

import { useCallback, useEffect, useState } from "react";
import type { HospitalPatientNeeds, HospitalRecommendation } from "rapid-cortex-shared";
import { RapidCortexMap } from "rapid-cortex-maps";
import type mapboxgl from "mapbox-gl";
import mapboxglLib from "mapbox-gl";

import { fetchHospitalRecommendations } from "@/lib/hospital-routing/api";
import { HospitalDetailModal } from "./hospital-detail-modal";
import { HospitalMarker } from "./hospital-marker";
import { HospitalTable } from "./hospital-table";

export interface HospitalDashboardProps {
  incidentLocation?: { lat: number; lon: number };
  patientNeeds?: HospitalPatientNeeds;
  onSelectForTransport?: (recommendation: HospitalRecommendation) => void;
}

function IncidentLocationMarker({
  map,
  latitude,
  longitude,
}: {
  map: mapboxgl.Map;
  latitude: number;
  longitude: number;
}) {
  useEffect(() => {
    const marker = new mapboxglLib.Marker({ color: "#DC2626", scale: 1.2 })
      .setLngLat([longitude, latitude])
      .setPopup(new mapboxglLib.Popup().setHTML("<strong>Incident location</strong>"))
      .addTo(map);
    return () => {
      marker.remove();
    };
  }, [map, latitude, longitude]);
  return null;
}

export function HospitalDashboard({
  incidentLocation,
  patientNeeds,
  onSelectForTransport,
}: HospitalDashboardProps) {
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [recommendations, setRecommendations] = useState<HospitalRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedHospital, setSelectedHospital] = useState<string | null>(null);
  const [detailHospitalId, setDetailHospitalId] = useState<string | null>(null);

  const loadRecommendations = useCallback(async () => {
    if (!incidentLocation) {
      setLoading(false);
      return;
    }
    try {
      const items = await fetchHospitalRecommendations({
        latitude: incidentLocation.lat,
        longitude: incidentLocation.lon,
        patientNeeds,
      });
      setRecommendations(items);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load hospitals");
    } finally {
      setLoading(false);
    }
  }, [incidentLocation, patientNeeds]);

  useEffect(() => {
    void loadRecommendations();
    const interval = setInterval(() => void loadRecommendations(), 60_000);
    return () => clearInterval(interval);
  }, [loadRecommendations]);

  if (loading) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center bg-slate-950 text-white">
        Loading hospital data…
      </div>
    );
  }

  if (!incidentLocation) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center bg-slate-950 p-8 text-center text-slate-300">
        Set an incident location to see hospital routing recommendations.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[480px] flex-col bg-slate-950">
      <header className="border-b border-slate-700 bg-slate-900 px-4 py-3">
        <h2 className="text-lg font-bold text-white">Hospital status</h2>
        <p className="text-sm text-slate-400">
          Real-time capacity and routing · {incidentLocation.lat.toFixed(4)},{" "}
          {incidentLocation.lon.toFixed(4)}
        </p>
        {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative min-h-[280px] flex-1">
          <RapidCortexMap
            className="h-full min-h-[280px]"
            center={[incidentLocation.lon, incidentLocation.lat]}
            zoom={11}
            theme="dark"
            onMapLoad={setMap}
          >
            {map && (
              <IncidentLocationMarker
                map={map}
                latitude={incidentLocation.lat}
                longitude={incidentLocation.lon}
              />
            )}
            {map &&
              recommendations.map((rec) => (
                <HospitalMarker
                  key={rec.hospitalId}
                  map={map}
                  hospital={rec.hospital}
                  capacity={rec.capacity}
                  recommendation={rec.recommendation}
                  isSelected={selectedHospital === rec.hospitalId}
                  onClick={() => setSelectedHospital(rec.hospitalId)}
                />
              ))}
          </RapidCortexMap>

          <div className="absolute bottom-3 left-3 rounded-lg bg-slate-900/90 px-3 py-2 text-xs text-slate-200 backdrop-blur-sm">
            <p className="font-semibold text-white">Legend</p>
            <p className="mt-1 text-emerald-400">Green — optimal</p>
            <p className="text-amber-400">Amber — acceptable</p>
            <p className="text-red-400">Red — limited / diversion</p>
          </div>
        </div>

        <div className="w-full min-h-0 border-t border-slate-700 lg:w-1/2 lg:border-l lg:border-t-0">
          <HospitalTable
            recommendations={recommendations}
            selectedHospital={selectedHospital}
            onSelectHospital={setSelectedHospital}
            onOpenDetail={setDetailHospitalId}
          />
        </div>
      </div>

      {detailHospitalId && (() => {
        const rec = recommendations.find((r) => r.hospitalId === detailHospitalId);
        if (!rec) return null;
        return (
          <HospitalDetailModal
            recommendation={rec}
            onClose={() => setDetailHospitalId(null)}
            onSelectForTransport={
              onSelectForTransport
                ? () => {
                    onSelectForTransport(rec);
                    setDetailHospitalId(null);
                  }
                : undefined
            }
          />
        );
      })()}
    </div>
  );
}
